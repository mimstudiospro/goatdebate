/** Hash routes for the app. Pure function of the hash string, so it
 * is unit-testable without a browser. */

export type Route =
  | { view: "home" }
  | { view: "debate"; slug: string }
  | { view: "signin" }
  | { view: "articles" }
  | { view: "article"; slug: string }
  | { view: "write" }
  | { view: "write-edit"; id: string };

const SLUG = "[a-z0-9-]+";
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, "");
  let match = path.match(new RegExp(`^debate/(${SLUG})$`));
  if (match) return { view: "debate", slug: match[1] };
  if (path === "signin") return { view: "signin" };
  if (path === "articles") return { view: "articles" };
  match = path.match(new RegExp(`^articles/(${SLUG})$`));
  if (match) return { view: "article", slug: match[1] };
  if (path === "write") return { view: "write" };
  match = path.match(new RegExp(`^write/(${UUID})$`, "i"));
  if (match) return { view: "write-edit", id: match[1].toLowerCase() };
  return { view: "home" };
}
