const { HttpError } = require('./http');

/** Returns the 8-digit CEP or throws a 400. Accepts "01310-100", "01310100", " 01310 100 ". */
function normalizeCep(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length !== 8 || /^0{8}$/.test(digits)) {
    throw new HttpError(400, 'invalid_cep', 'Informe um CEP válido com 8 dígitos.');
  }
  return digits;
}

function formatCep(cep) {
  return `${cep.slice(0, 5)}-${cep.slice(5)}`;
}

/**
 * Address from ViaCEP (public API). Returns null when the CEP doesn't exist,
 * undefined when ViaCEP can't be reached (coverage still works without the address).
 */
async function lookupAddress(cep, { timeoutMs = 4000 } = {}) {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(timeoutMs) });
    if (res.status === 400) return null;
    if (!res.ok) return undefined;
    const data = await res.json();
    if (data.erro) return null;
    return {
      cep: formatCep(cep),
      street: data.logradouro || '',
      neighborhood: data.bairro || '',
      city: data.localidade || '',
      state: data.uf || '',
    };
  } catch (e) {
    return undefined;
  }
}

module.exports = { normalizeCep, formatCep, lookupAddress };
