import bcrypt from "bcryptjs"
import { getMissionEnv } from "@/lib/env"

const SALT_ROUNDS = 12

/**
 * Applies the optional pepper from ENV to the plain password before hashing.
 * Pepper is prepended for defense in depth when MISSION_CONTROL_PASSWORD_PEPPER is set.
 *
 * @param plain - Raw password from user input
 * @returns String to pass to bcrypt (plain or pepper + plain)
 */
function applyPepper(plain: string): string {
  const env = getMissionEnv()
  if (!env.passwordPepper) {
    return plain
  }
  return `${env.passwordPepper}${plain}`
}

/**
 * Hashes a plain password using bcrypt with optional pepper from ENV.
 *
 * @param plain - Raw password from user input
 * @returns Bcrypt hash string
 */
export async function hashPassword(plain: string): Promise<string> {
  const toHash = applyPepper(plain)
  return bcrypt.hash(toHash, SALT_ROUNDS)
}

/**
 * Verifies a plain password against a bcrypt hash.
 * Uses the same pepper logic as hashPassword when ENV pepper is set.
 *
 * @param plain - Raw password from user input
 * @param hash - Stored bcrypt hash
 * @returns True if password matches
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  const toVerify = applyPepper(plain)
  return bcrypt.compare(toVerify, hash)
}
