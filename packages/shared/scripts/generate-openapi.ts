import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  AccountDeleteBody,
  AccountDeleteResult,
  ApiErrorSchema,
  AppleAuthBody,
  AttachPhotoBody,
  Balance,
  BalanceViewerResponse,
  ChildSessionBody,
  ChildSessionRefreshBody,
  ChildSessionResult,
  ChildTodayView,
  CompleteResult,
  CreateChildBody,
  MemberView,
  DeviceBody,
  DeviceOkResponse,
  FamilyCodeResult,
  FamilyCodeBody,
  FamilyViewerResponse,
  InstanceView,
  LoginBody,
  NotificationSetting,
  NotificationSettingsPatch,
  NotificationSettingsResponse,
  ParentSessionResult,
  ParentTodayView,
  PhotoConfirmResponse,
  PhotoStatusResponse,
  PushPayload,
  RedeemResult,
  RedemptionsViewerResponse,
  RefreshBody,
  RegisterBody,
  RewardsViewerResponse,
  SyncBody,
  SyncResponse,
  TodayViewerResponse,
  UploadIntentBody,
  UploadIntentResponse,
  AvatarCatalogItem,
  AvatarCatalogResponse,
  MemberAvatarState,
  EquipAvatarBody,
  FamilyGoal,
  FamilyGoalsResponse,
  FamilyGoalProgress,
  FamilyGoalProgressResponse,
  CreateFamilyGoalBody,
  PatchFamilyGoalBody,
  InviteResponse,
  InviteLinkResponse,
  PendingApprovalResponse,
  InviteParentBody,
} from "../src/index";

type JsonSchema = Record<string, unknown>;

function schemaFor(name: string, schema: unknown): JsonSchema {
  return zodToJsonSchema(schema, {
    name,
    target: "openApi3",
    $refStrategy: "none",
  }) as JsonSchema;
}

const schemas: Record<string, JsonSchema> = {
  ApiError: schemaFor("ApiError", ApiErrorSchema),
  RegisterBody: schemaFor("RegisterBody", RegisterBody),
  LoginBody: schemaFor("LoginBody", LoginBody),
  AppleAuthBody: schemaFor("AppleAuthBody", AppleAuthBody),
  FamilyCodeBody: schemaFor("FamilyCodeBody", FamilyCodeBody),
  ChildSessionBody: schemaFor("ChildSessionBody", ChildSessionBody),
  ChildSessionRefreshBody: schemaFor("ChildSessionRefreshBody", ChildSessionRefreshBody),
  ChildSessionResult: schemaFor("ChildSessionResult", ChildSessionResult),
  FamilyCodeResult: schemaFor("FamilyCodeResult", FamilyCodeResult),
  ParentSessionResult: schemaFor("ParentSessionResult", ParentSessionResult),
  RefreshBody: schemaFor("RefreshBody", RefreshBody),
  CreateChildBody: schemaFor("CreateChildBody", CreateChildBody),
  MemberView: schemaFor("MemberView", MemberView),
  AccountDeleteBody: schemaFor("AccountDeleteBody", AccountDeleteBody),
  AccountDeleteResult: schemaFor("AccountDeleteResult", AccountDeleteResult),
  FamilyViewerResponse: schemaFor("FamilyViewerResponse", FamilyViewerResponse),
  InstanceView: schemaFor("InstanceView", InstanceView),
  ChildTodayView: schemaFor("ChildTodayView", ChildTodayView),
  ParentTodayView: schemaFor("ParentTodayView", ParentTodayView),
  TodayViewerResponse: schemaFor("TodayViewerResponse", TodayViewerResponse),
  CompleteResult: schemaFor("CompleteResult", CompleteResult),
  AttachPhotoBody: schemaFor("AttachPhotoBody", AttachPhotoBody),
  Balance: schemaFor("Balance", Balance),
  BalanceViewerResponse: schemaFor("BalanceViewerResponse", BalanceViewerResponse),
  RewardsViewerResponse: schemaFor("RewardsViewerResponse", RewardsViewerResponse),
  RedeemResult: schemaFor("RedeemResult", RedeemResult),
  RedemptionsViewerResponse: schemaFor("RedemptionsViewerResponse", RedemptionsViewerResponse),
  SyncBody: schemaFor("SyncBody", SyncBody),
  SyncResponse: schemaFor("SyncResponse", SyncResponse),
  UploadIntentBody: schemaFor("UploadIntentBody", UploadIntentBody),
  UploadIntentResponse: schemaFor("UploadIntentResponse", UploadIntentResponse),
  PhotoStatusResponse: schemaFor("PhotoStatusResponse", PhotoStatusResponse),
  PhotoConfirmResponse: schemaFor("PhotoConfirmResponse", PhotoConfirmResponse),
  DeviceBody: schemaFor("DeviceBody", DeviceBody),
  DeviceOkResponse: schemaFor("DeviceOkResponse", DeviceOkResponse),
  NotificationSettingsResponse: schemaFor("NotificationSettingsResponse", NotificationSettingsResponse),
  NotificationSetting: schemaFor("NotificationSetting", NotificationSetting),
  NotificationSettingsPatch: schemaFor("NotificationSettingsPatch", NotificationSettingsPatch),
  PushPayload: schemaFor("PushPayload", PushPayload),
  AvatarCatalogItem: schemaFor("AvatarCatalogItem", AvatarCatalogItem),
  AvatarCatalogResponse: schemaFor("AvatarCatalogResponse", AvatarCatalogResponse),
  MemberAvatarState: schemaFor("MemberAvatarState", MemberAvatarState),
  EquipAvatarBody: schemaFor("EquipAvatarBody", EquipAvatarBody),
  FamilyGoal: schemaFor("FamilyGoal", FamilyGoal),
  FamilyGoalsResponse: schemaFor("FamilyGoalsResponse", FamilyGoalsResponse),
  FamilyGoalProgress: schemaFor("FamilyGoalProgress", FamilyGoalProgress),
  FamilyGoalProgressResponse: schemaFor("FamilyGoalProgressResponse", FamilyGoalProgressResponse),
  CreateFamilyGoalBody: schemaFor("CreateFamilyGoalBody", CreateFamilyGoalBody),
  PatchFamilyGoalBody: schemaFor("PatchFamilyGoalBody", PatchFamilyGoalBody),
  InviteParentBody: schemaFor("InviteParentBody", InviteParentBody),
  InviteResponse: schemaFor("InviteResponse", InviteResponse),
  InviteLinkResponse: schemaFor("InviteLinkResponse", InviteLinkResponse),
  PendingApprovalResponse: schemaFor("PendingApprovalResponse", PendingApprovalResponse),
};

function json(schemaName: string) {
  return {
    content: {
      "application/json": {
        schema: {
          $ref: `#/components/schemas/${schemaName}`,
        },
      },
    },
  };
}

const spec = {
  openapi: "3.1.0",
  info: {
    title: "Wispel core API",
    version: "0.1.0",
    description:
      "Generated core contract snapshot from packages/shared. Covers web dashboard and iOS Phase 1 endpoints.",
  },
  servers: [{ url: "/v1" }],
  paths: {
    "/auth/register": {
      post: {
        summary: "Register a parent and family",
        requestBody: { required: true, ...json("RegisterBody") },
        responses: { "201": json("ParentSessionResult"), "400": json("ApiError") },
      },
    },
    "/auth/login": {
      post: {
        summary: "Log in a parent account",
        requestBody: { required: true, ...json("LoginBody") },
        responses: { "200": json("ParentSessionResult"), "401": json("ApiError") },
      },
    },
    "/auth/apple": {
      post: {
        summary: "Sign in with Apple",
        requestBody: { required: true, ...json("AppleAuthBody") },
        responses: { "200": json("ParentSessionResult"), "201": json("ParentSessionResult"), "401": json("ApiError") },
      },
    },
    "/auth/refresh": {
      post: {
        summary: "Rotate a parent refresh token",
        requestBody: { required: true, ...json("RefreshBody") },
        responses: { "200": json("ParentSessionResult"), "401": json("ApiError") },
      },
    },
    "/auth/family-code": {
      post: {
        summary: "Resolve a family code to child profiles",
        requestBody: { required: true, ...json("FamilyCodeBody") },
        responses: { "200": json("FamilyCodeResult"), "404": json("ApiError") },
      },
    },
    "/auth/child-session": {
      post: {
        summary: "Pair a child device session",
        requestBody: { required: true, ...json("ChildSessionBody") },
        responses: { "200": json("ChildSessionResult"), "401": json("ApiError") },
      },
    },
    "/auth/child-session/refresh": {
      post: {
        summary: "Rotate a child device refresh token",
        requestBody: { required: true, ...json("ChildSessionRefreshBody") },
        responses: { "200": json("ChildSessionResult"), "401": json("ApiError") },
      },
    },
    "/members/children": {
      post: {
        summary: "Create a child profile",
        responses: { "201": json("MemberView"), "403": json("ApiError") },
        requestBody: { required: true, ...json("CreateChildBody") },
      },
    },
    "/families/me": {
      get: {
        summary: "Read the current family",
        responses: { "200": json("FamilyViewerResponse"), "404": json("ApiError") },
      },
    },
    "/instances/today": {
      get: {
        summary: "Read today's instances",
        responses: { "200": json("TodayViewerResponse"), "404": json("ApiError") },
      },
    },
    "/instances/pending-approval": {
      get: {
        summary: "Parent approval queue across dates (submitted instances, oldest first)",
        responses: { "200": json("PendingApprovalResponse"), "403": json("ApiError") },
      },
    },
    "/families/me/parents": {
      post: {
        summary: "Invite a co-parent (token delivered by email; not echoed in body)",
        requestBody: { required: true, ...json("InviteParentBody") },
        responses: { "201": json("InviteResponse"), "403": json("ApiError"), "409": json("ApiError") },
      },
    },
    "/families/me/invites/{userId}/link": {
      get: {
        summary: "Mint a copyable invite URL (parent-only, rate-limited reveal)",
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": json("InviteLinkResponse"), "403": json("ApiError"), "404": json("ApiError") },
      },
    },
    "/instances/{id}/complete": {
      post: {
        summary: "Complete a task instance",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": json("CompleteResult"), "409": json("ApiError") },
      },
    },
    "/instances/{id}/undo": {
      post: {
        summary: "Undo a recent completion",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": json("InstanceView"), "409": json("ApiError") },
      },
    },
    "/instances/{id}/photo": {
      post: {
        summary: "Attach a ready photo to an instance",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, ...json("AttachPhotoBody") },
        responses: { "200": json("CompleteResult"), "409": json("ApiError") },
      },
    },
    "/points/balance": {
      get: {
        summary: "Read current balance and progress",
        responses: { "200": json("BalanceViewerResponse"), "404": json("ApiError") },
      },
    },
    "/rewards": {
      get: {
        summary: "Read rewards and savings goal state",
        responses: { "200": json("RewardsViewerResponse"), "404": json("ApiError") },
      },
    },
    "/rewards/{id}/redeem": {
      post: {
        summary: "Redeem a reward",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": json("RedeemResult"), "409": json("ApiError") },
      },
    },
    "/redemptions": {
      get: {
        summary: "Read redemptions for the current viewer",
        responses: { "200": json("RedemptionsViewerResponse"), "403": json("ApiError") },
      },
    },
    "/sync": {
      post: {
        summary: "Batch offline sync",
        requestBody: { required: true, ...json("SyncBody") },
        responses: { "200": json("SyncResponse"), "400": json("ApiError") },
      },
    },
    "/photos/upload-intent": {
      post: {
        summary: "Create a photo upload intent",
        requestBody: { required: true, ...json("UploadIntentBody") },
        responses: { "201": json("UploadIntentResponse"), "403": json("ApiError") },
      },
    },
    "/photos/{id}/confirm": {
      post: {
        summary: "Confirm an uploaded photo",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": json("PhotoConfirmResponse"), "409": json("ApiError") },
      },
    },
    "/photos/{id}": {
      get: {
        summary: "Read photo status",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": json("PhotoStatusResponse"), "404": json("ApiError") },
      },
    },
    "/devices": {
      post: {
        summary: "Register an APNs device token",
        requestBody: { required: true, ...json("DeviceBody") },
        responses: { "201": json("DeviceOkResponse"), "403": json("ApiError") },
      },
    },
    "/notification-settings": {
      get: {
        summary: "List notification settings",
        responses: { "200": json("NotificationSettingsResponse"), "403": json("ApiError") },
      },
      patch: {
        summary: "Update one child's notification settings",
        requestBody: { required: true, ...json("NotificationSettingsPatch") },
        responses: { "200": json("NotificationSetting"), "404": json("ApiError") },
      },
    },
    "/account": {
      delete: {
        summary: "Soft-delete the family account",
        requestBody: { required: true, ...json("AccountDeleteBody") },
        responses: { "200": json("AccountDeleteResult"), "401": json("ApiError") },
      },
    },
    "/avatar/catalog": {
      get: {
        summary: "List avatar cosmetic catalogue (progression unlocks, no IAP)",
        responses: { "200": json("AvatarCatalogResponse"), "401": json("ApiError") },
      },
    },
    "/members/{id}/avatar": {
      get: {
        summary: "Read equipped + unlocked avatar state for a child",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": json("MemberAvatarState"), "403": json("ApiError"), "404": json("ApiError") },
      },
      patch: {
        summary: "Equip unlocked avatar items (idempotent)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, ...json("EquipAvatarBody") },
        responses: { "200": json("MemberAvatarState"), "403": json("ApiError"), "404": json("ApiError") },
      },
    },
    "/families/me/goals": {
      get: {
        summary: "List non-archived family goals",
        responses: { "200": json("FamilyGoalsResponse"), "401": json("ApiError") },
      },
      post: {
        summary: "Create a cooperative family goal (one active max)",
        requestBody: { required: true, ...json("CreateFamilyGoalBody") },
        responses: { "201": json("FamilyGoal"), "403": json("ApiError"), "409": json("ApiError") },
      },
    },
    "/families/me/goals/active/progress": {
      get: {
        summary: "Active family goal progress (sum of earned points, no sibling ranking)",
        responses: { "200": json("FamilyGoalProgressResponse"), "401": json("ApiError") },
      },
    },
    "/families/me/goals/{id}": {
      get: {
        summary: "Get one family goal",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": json("FamilyGoal"), "404": json("ApiError") },
      },
      patch: {
        summary: "Archive or complete a family goal",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, ...json("PatchFamilyGoalBody") },
        responses: { "200": json("FamilyGoal"), "403": json("ApiError"), "404": json("ApiError") },
      },
    },
  },
  components: {
    schemas,
  },
} as const;

const outputPath = resolve(process.cwd(), "../../docs/openapi/taakhelden-core-v1.json");
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(spec, null, 2)}\n`);
