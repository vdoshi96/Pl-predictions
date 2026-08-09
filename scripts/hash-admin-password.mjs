import { pbkdf2Sync, randomBytes } from "node:crypto";
import process from "node:process";

const algorithm = "pbkdf2_sha256";
const iterations = 600_000;
const digestBytes = 32;
const saltBytes = 16;
const minimumPasswordBytes = 9;
const maximumPasswordBytes = 4_096;

process.stdin.setEncoding("utf8");

let input = "";
for await (const chunk of process.stdin) input += chunk;

// Command-line secret providers conventionally append one line ending. Keep
// every other character intact so spaces remain part of the password.
const password = input.replace(/\r?\n$/u, "");
const passwordBytes = Buffer.byteLength(password, "utf8");

if (
  passwordBytes < minimumPasswordBytes ||
  passwordBytes > maximumPasswordBytes
) {
  process.stderr.write(
    `Administrator passwords must be ${minimumPasswordBytes}–${maximumPasswordBytes} UTF-8 bytes.\n`,
  );
  process.exit(1);
}

const salt = randomBytes(saltBytes);
const digest = pbkdf2Sync(password, salt, iterations, digestBytes, "sha256");

process.stdout.write(
  [
    algorithm,
    iterations,
    salt.toString("base64url"),
    digest.toString("base64url"),
  ].join("$") + "\n",
);
