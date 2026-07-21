import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware navigation helpers that keep the active locale in the URL.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
