import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Draait de Next.js-app (SSR + middleware + BFF-routes) op Cloudflare Workers.
// Standaardconfig is voldoende; caching kan later met R2/KV worden aangezet.
export default defineCloudflareConfig();
