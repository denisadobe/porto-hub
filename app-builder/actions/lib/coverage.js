const { HttpError } = require('./http');
const { normalizeCep, formatCep, lookupAddress } = require('./cep');
const { loadCoverage } = require('./config');

const SKU_RE = /^[A-Za-z0-9._-]{1,64}$/;

function normalizeSku(value, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, 'invalid_sku', 'Serviço não informado.');
    return null;
  }
  const sku = String(value).trim();
  if (!SKU_RE.test(sku)) throw new HttpError(400, 'invalid_sku', 'Serviço inválido.');
  return sku;
}

function findRegion(coverage, cep) {
  return coverage.regions.find((r) => r.active && r.ranges.some(({ from, to }) => cep >= from && cep <= to)) || null;
}

function offersService(region, sku) {
  return !sku || region.services.includes('*') || region.services.includes(sku);
}

/**
 * Coverage decision for a CEP (and optionally a service SKU).
 * withAddress=false skips the ViaCEP call (used by slots/reserve, which already validated it).
 */
async function checkCoverage({ cep: rawCep, sku: rawSku }, { withAddress = true } = {}) {
  const cep = normalizeCep(rawCep);
  const sku = normalizeSku(rawSku);
  let address;
  if (withAddress) {
    address = await lookupAddress(cep);
    if (address === null) {
      throw new HttpError(404, 'cep_not_found', 'Não encontramos esse CEP. Confira os números e tente de novo.');
    }
  }
  const region = findRegion(await loadCoverage(), cep);
  const base = {
    cep: formatCep(cep),
    ...(withAddress ? { address: address || null, addressLookup: address ? 'ok' : 'unavailable' } : {}),
  };
  if (!region) {
    return {
      ...base, served: false, reason: 'region', region: null, message: 'Ainda não atendemos sua região. Estamos ampliando nossa cobertura.',
    };
  }
  const regionInfo = { id: region.id, name: region.name };
  if (!offersService(region, sku)) {
    return {
      ...base, served: false, reason: 'service', region: regionInfo, message: 'Este serviço ainda não está disponível na sua região.',
    };
  }
  return {
    ...base, served: true, region: regionInfo, message: `Boa notícia! Atendemos ${region.name}.`,
  };
}

/** Same as checkCoverage but throws when not served; returns { cep, sku, region }. */
async function requireCoverage({ cep, sku }) {
  const result = await checkCoverage({ cep, sku }, { withAddress: false });
  if (!result.served) throw new HttpError(422, `not_served_${result.reason}`, result.message);
  return { cep: result.cep.replace('-', ''), sku: normalizeSku(sku, { required: true }), region: result.region };
}

module.exports = {
  normalizeSku, findRegion, offersService, checkCoverage, requireCoverage,
};
