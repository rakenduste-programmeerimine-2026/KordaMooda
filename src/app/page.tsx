import { App } from "@/components/App";
import { canImportHousehold, getHousehold } from "@/lib/actions";

/**
 * The household is loaded on the server, so the first paint already shows whose turn it is
 * (success criterion: visible within 10 seconds of opening the app).
 */
export default async function Page() {
  const [initial, canImport] = await Promise.all([getHousehold(), canImportHousehold()]);
  return <App initial={initial} canImport={canImport} />;
}
