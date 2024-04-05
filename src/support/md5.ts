import { createHash } from "crypto";
import type { BinaryLike } from "crypto";

export function md5(source: BinaryLike) {
  return createHash("md5").update(source).digest("base64url");
}
