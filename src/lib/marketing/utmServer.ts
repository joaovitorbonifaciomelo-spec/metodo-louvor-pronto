import { cookies } from "next/headers";
import { UTM_COOKIE_NAME, parseUtmCookie, type UtmData } from "./utm";

/**
 * Lê a atribuição first-touch gravada pelo client (ver utmClient.ts) a
 * partir dos cookies da requisição atual. Usado em /assinar para anexar os
 * parâmetros à URL de checkout da Kiwify — nunca grava nada aqui, só lê.
 *
 * `cookies().get(...).value` já vem decodificado pelo parser de cookies do
 * Next (confirmado empiricamente) — decodeURIComponent aqui de novo quebra
 * com "URI malformed" sempre que o valor original tinha um "%" (ex.: "100%
 * off" em utm_campaign).
 */
export function getStoredUtm(): UtmData {
  const raw = cookies().get(UTM_COOKIE_NAME)?.value;
  return parseUtmCookie(raw);
}
