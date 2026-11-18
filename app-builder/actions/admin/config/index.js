/*
 * Admin: coverage and agenda configuration.
 * GET  -> { coverage, agenda } (saved values, or the demo defaults)
 * POST { coverage } | { agenda } -> saves (sanitized) and returns the saved value
 */
const { HttpError } = require('../../lib/http');
const { adminAction } = require('../../lib/admin');
const {
  loadCoverage, loadAgenda, saveCoverage, saveAgenda,
} = require('../../lib/config');

exports.main = adminAction(['get', 'post'], async (params) => {
  const method = (params.__ow_method || 'get').toLowerCase();
  if (method === 'get') return { coverage: await loadCoverage(), agenda: await loadAgenda() };
  if (params.coverage) {
    const saved = await saveCoverage(params.coverage);
    if (!saved.regions.length) throw new HttpError(422, 'empty_coverage', 'Cadastre pelo menos uma região com faixa de CEP válida.');
    return { coverage: saved };
  }
  if (params.agenda) {
    const saved = await saveAgenda(params.agenda);
    if (!saved.shifts.length) throw new HttpError(422, 'empty_agenda', 'Cadastre pelo menos um turno válido.');
    return { agenda: saved };
  }
  throw new HttpError(400, 'nothing_to_save', 'Nada para salvar.');
});
