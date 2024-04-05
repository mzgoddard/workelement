import { md5 } from "./md5";

const ABBREVIATE_LENGTH = 128;
const MD5_LENGTH = 28;
const PREFIX_MD5_LENGTH = ABBREVIATE_LENGTH - MD5_LENGTH;

export const abbreviate = (s: string) =>
  s.length > ABBREVIATE_LENGTH
    ? `${s.slice(0, PREFIX_MD5_LENGTH)}..md5/${md5(s)}`
    : s;
