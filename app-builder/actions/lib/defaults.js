/*
 * Demo data used until an admin saves their own configuration (Admin UI SDK screens, later stage).
 * CEP ranges are 8-digit strings, inclusive. services: ['*'] = every service, or a list of SKUs.
 */
const DEFAULT_COVERAGE = {
  regions: [
    {
      id: 'sp-capital',
      name: 'São Paulo (capital)',
      active: true,
      services: ['*'],
      ranges: [{ from: '01000000', to: '05999999' }, { from: '08000000', to: '08499999' }],
    },
    {
      id: 'grande-sp',
      name: 'Grande São Paulo',
      active: true,
      services: ['*'],
      ranges: [{ from: '06000000', to: '07999999' }, { from: '08500000', to: '09999999' }],
    },
    {
      id: 'campinas',
      name: 'Campinas e região',
      active: true,
      services: ['*'],
      ranges: [{ from: '13000000', to: '13149999' }],
    },
    {
      id: 'rio-de-janeiro',
      name: 'Rio de Janeiro (capital)',
      active: true,
      services: ['*'],
      ranges: [{ from: '20000000', to: '23799999' }],
    },
    {
      id: 'belo-horizonte',
      name: 'Belo Horizonte',
      active: true,
      services: ['*'],
      ranges: [{ from: '30000000', to: '31999999' }],
    },
    {
      id: 'curitiba',
      name: 'Curitiba',
      active: true,
      services: ['*'],
      ranges: [{ from: '80000000', to: '82999999' }],
    },
  ],
};

/*
 * weekdays: 0 = Sunday ... 6 = Saturday. capacity = simultaneous bookings per region, day and shift.
 * regions: optional per-region overrides, e.g. { campinas: { capacity: { manha: 2 } } }.
 * simulatedOccupancy: pre-fills part of each shift so the demo agenda doesn't look empty.
 */
const DEFAULT_AGENDA = {
  timeZone: 'America/Sao_Paulo',
  leadDays: 1,
  horizonDays: 14,
  holdMinutes: 15,
  simulatedOccupancy: true,
  shifts: [
    {
      id: 'manha', label: 'Manhã', start: '08:00', end: '12:00', capacity: 4, weekdays: [1, 2, 3, 4, 5, 6],
    },
    {
      id: 'tarde', label: 'Tarde', start: '13:00', end: '18:00', capacity: 3, weekdays: [1, 2, 3, 4, 5],
    },
  ],
  blockedDates: [
    { date: '2026-11-20', reason: 'Dia da Consciência Negra' },
    { date: '2026-12-25', reason: 'Natal' },
    { date: '2027-01-01', reason: 'Confraternização Universal' },
  ],
  regions: {},
};

module.exports = { DEFAULT_COVERAGE, DEFAULT_AGENDA };
