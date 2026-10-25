export function inviteCopyText(joinPath: string, origin: string, kind: "code" | "link") {
  const url = new URL(joinPath, origin);
  if (kind === "code") return url.searchParams.get("trip") ?? url.searchParams.get("code") ?? "";
  return url.toString();
}
