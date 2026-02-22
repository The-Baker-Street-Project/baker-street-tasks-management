import { getTags } from "@/lib/api/views";
import { SettingsPageClient } from "./settings-page-client";

export default async function SettingsPage() {
  const tags = await getTags();
  return <SettingsPageClient initialTags={tags} />;
}
