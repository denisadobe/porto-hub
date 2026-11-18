/*
 * Calls to the Porto Serviço App Builder actions from the admin page.
 * The page is served from https://<namespace>.adobeio-static.net/…, the actions live at
 * https://<namespace>.adobeioruntime.net/api/v1/web/<package>/<action>.
 * Admin actions get the signed-in admin's IMS token (useIms) and org.
 */
import { useIms } from "@adobe/aio-commerce-lib-admin-ui/web";

function runtimeBase() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("api")) return params.get("api");
  const [namespace] = window.location.hostname.split(".");
  return `https://${namespace}.adobeioruntime.net/api/v1/web`;
}

/** IMS credentials; `?mock` gives fake ones to preview the page outside Commerce. */
export function useCredentials() {
  const ims = useIms();
  if (ims?.data?.imsToken) return { token: ims.data.imsToken, org: ims.data.imsOrgId };
  if (new URLSearchParams(window.location.search).has("mock")) return { token: "mock", org: "mock" };
  return null;
}

async function request(url, { method = "GET", body, credentials } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (credentials) {
    headers.Authorization = `Bearer ${credentials.token}`;
    headers["x-gw-ims-org-id"] = credentials.org;
  }
  let res;
  try {
    res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw new Error("Não foi possível conectar ao serviço. Tente novamente.");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message || `Erro ${res.status} ao falar com o serviço.`);
  return json;
}

export function adminApi(credentials) {
  const base = `${runtimeBase()}/porto-servico-admin`;
  return {
    getConfig: () => request(`${base}/config`, { credentials }),
    saveCoverage: (coverage) => request(`${base}/config`, { method: "POST", body: { coverage }, credentials }),
    saveAgenda: (agenda) => request(`${base}/config`, { method: "POST", body: { agenda }, credentials }),
    listBookings: () => request(`${base}/bookings`, { credentials }),
    releaseBooking: (id) => request(`${base}/bookings`, { method: "POST", body: { action: "release", id }, credentials }),
  };
}

/** Public storefront action, used by "Testar CEP". */
export function testCoverage(cep) {
  return request(`${runtimeBase()}/porto-servico/coverage?cep=${encodeURIComponent(cep)}`);
}

export const formatCep = (v) => {
  const d = String(v || "").replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

export function longDate(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC", weekday: "short", day: "2-digit", month: "short",
  }).format(new Date(`${date}T12:00:00Z`));
}
