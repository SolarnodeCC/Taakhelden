import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  AccountDeleteBody,
  AccountDeleteResult,
  ApiErrorSchema,
  Balance,
  BalanceViewerResponse,
  ChildSessionBody,
  ChildSessionRefreshBody,
  ChildSessionResult,
  ChildTodayView,
  FamilyCodeResult,
  FamilyCodeBody,
  FamilyViewerResponse,
  LoginBody,
  NotificationSetting,
  NotificationSettingsPatch,
  NotificationSettingsResponse,
  ParentSessionResult,
  ParentTodayView,
  PushPayload,
  RedemptionsViewerResponse,
  RefreshBody,
  RegisterBody,
  RewardsViewerResponse,
  TodayViewerResponse,
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
  FamilyCodeBody: schemaFor("FamilyCodeBody", FamilyCodeBody),
  ChildSessionBody: schemaFor("ChildSessionBody", ChildSessionBody),
  ChildSessionRefreshBody: schemaFor("ChildSessionRefreshBody", ChildSessionRefreshBody),
  ChildSessionResult: schemaFor("ChildSessionResult", ChildSessionResult),
  FamilyCodeResult: schemaFor("FamilyCodeResult", FamilyCodeResult),
  ParentSessionResult: schemaFor("ParentSessionResult", ParentSessionResult),
  RefreshBody: schemaFor("RefreshBody", RefreshBody),
  AccountDeleteBody: schemaFor("AccountDeleteBody", AccountDeleteBody),
  AccountDeleteResult: schemaFor("AccountDeleteResult", AccountDeleteResult),
  FamilyViewerResponse: schemaFor("FamilyViewerResponse", FamilyViewerResponse),
  ChildTodayView: schemaFor("ChildTodayView", ChildTodayView),
  ParentTodayView: schemaFor("ParentTodayView", ParentTodayView),
  TodayViewerResponse: schemaFor("TodayViewerResponse", TodayViewerResponse),
  Balance: schemaFor("Balance", Balance),
  BalanceViewerResponse: schemaFor("BalanceViewerResponse", BalanceViewerResponse),
  RewardsViewerResponse: schemaFor("RewardsViewerResponse", RewardsViewerResponse),
  RedemptionsViewerResponse: schemaFor("RedemptionsViewerResponse", RedemptionsViewerResponse),
  NotificationSettingsResponse: schemaFor("NotificationSettingsResponse", NotificationSettingsResponse),
  NotificationSetting: schemaFor("NotificationSetting", NotificationSetting),
  NotificationSettingsPatch: schemaFor("NotificationSettingsPatch", NotificationSettingsPatch),
  PushPayload: schemaFor("PushPayload", PushPayload),
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
    title: "TaakHelden core API",
    version: "0.1.0",
    description:
      "Generated core contract snapshot from packages/shared. Focused on the endpoints the web dashboard and iOS phase-0 foundation depend on.",
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
    "/redemptions": {
      get: {
        summary: "Read redemptions for the current viewer",
        responses: { "200": json("RedemptionsViewerResponse"), "403": json("ApiError") },
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
  },
  components: {
    schemas,
  },
} as const;

const outputPath = resolve(process.cwd(), "../../docs/openapi/taakhelden-core-v1.json");
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(spec, null, 2)}\n`);
