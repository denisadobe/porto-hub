import { useState } from "react";
import {
  ActionButton, Button, Checkbox, CheckboxGroup, Content, Heading, InlineAlert, NumberField, Switch, TextField,
} from "@react-spectrum/s2";
import { longDate } from "../api.js";

const WEEKDAYS = [
  ["1", "Seg"], ["2", "Ter"], ["3", "Qua"], ["4", "Qui"], ["5", "Sex"], ["6", "Sáb"], ["0", "Dom"],
];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Agenda: shifts, capacity, weekdays, blocked dates and booking rules. */
export function AgendaTab({ api, agenda, onSaved, notify }) {
  const [draft, setDraft] = useState(agenda);
  const [newDate, setNewDate] = useState("");
  const [newReason, setNewReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setShift = (i, patch) => set({ shifts: draft.shifts.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  const addShift = () => set({
    shifts: [...draft.shifts, {
      id: `turno-${draft.shifts.length + 1}`, label: "Novo turno", start: "18:00", end: "21:00", capacity: 2, weekdays: [1, 2, 3, 4, 5],
    }],
  });
  const addBlocked = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return;
    set({ blockedDates: [...draft.blockedDates.filter((b) => b.date !== newDate), { date: newDate, reason: newReason }].sort((a, b) => a.date.localeCompare(b.date)) });
    setNewDate("");
    setNewReason("");
  };

  const invalid = draft.shifts.some((s) => !TIME.test(s.start) || !TIME.test(s.end) || s.start >= s.end);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const { agenda: saved } = await api.saveAgenda(draft);
      setDraft(saved);
      onSaved(saved);
      notify("Agenda salva. Os novos horários já aparecem no site.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="ps-tab">
      {error && (
        <InlineAlert variant="negative"><Heading>Não foi possível salvar</Heading><Content>{error}</Content></InlineAlert>
      )}

      <div className="ps-card">
        <Heading level={3}>Regras de agendamento</Heading>
        <div className="ps-row ps-wrap">
          <NumberField label="Antecedência mínima (dias)" value={draft.leadDays} minValue={0} maxValue={30} onChange={(leadDays) => set({ leadDays })} />
          <NumberField label="Dias exibidos no site" value={draft.horizonDays} minValue={1} maxValue={60} onChange={(horizonDays) => set({ horizonDays })} />
          <NumberField label="Tempo de reserva no checkout (min)" value={draft.holdMinutes} minValue={1} maxValue={60} onChange={(holdMinutes) => set({ holdMinutes })} />
        </div>
        <Switch isSelected={draft.simulatedOccupancy} onChange={(simulatedOccupancy) => set({ simulatedOccupancy })}>
          Ocupação simulada para a demo (parte dos turnos aparece ocupada)
        </Switch>
      </div>

      <div className="ps-card">
        <Heading level={3}>Turnos</Heading>
        <p className="ps-muted">Vagas = atendimentos simultâneos por região, dia e turno.</p>
        {draft.shifts.map((s, i) => (
          <div className="ps-shift" key={s.id}>
            <TextField label="Turno" value={s.label} onChange={(label) => setShift(i, { label })} />
            <TextField label="Início" value={s.start} onChange={(start) => setShift(i, { start })} placeholder="08:00" isInvalid={!TIME.test(s.start)} />
            <TextField label="Fim" value={s.end} onChange={(end) => setShift(i, { end })} placeholder="12:00" isInvalid={!TIME.test(s.end)} />
            <NumberField label="Vagas" value={s.capacity} minValue={0} maxValue={100} onChange={(capacity) => setShift(i, { capacity })} />
            <CheckboxGroup
              label="Dias"
              orientation="horizontal"
              value={s.weekdays.map(String)}
              onChange={(v) => setShift(i, { weekdays: v.map(Number) })}
            >
              {WEEKDAYS.map(([value, label]) => <Checkbox key={value} value={value}>{label}</Checkbox>)}
            </CheckboxGroup>
            <ActionButton onPress={() => set({ shifts: draft.shifts.filter((_, j) => j !== i) })}>Remover</ActionButton>
          </div>
        ))}
        <ActionButton onPress={addShift}>Adicionar turno</ActionButton>
      </div>

      <div className="ps-card">
        <Heading level={3}>Datas sem atendimento</Heading>
        <ul className="ps-blocked">
          {draft.blockedDates.length === 0 && <li className="ps-muted">Nenhuma data bloqueada.</li>}
          {draft.blockedDates.map((b) => (
            <li key={b.date}>
              <strong>{longDate(b.date)}</strong> {b.reason && <span className="ps-muted">– {b.reason}</span>}
              <ActionButton size="S" onPress={() => set({ blockedDates: draft.blockedDates.filter((x) => x.date !== b.date) })}>Remover</ActionButton>
            </li>
          ))}
        </ul>
        <div className="ps-row ps-wrap">
          <label className="ps-native-field">
            <span>Data</span>
            <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </label>
          <TextField label="Motivo" value={newReason} onChange={setNewReason} placeholder="Feriado" />
          <ActionButton onPress={addBlocked} isDisabled={!newDate}>Bloquear data</ActionButton>
        </div>
      </div>

      <div className="ps-footer">
        <Button variant="accent" onPress={save} isPending={saving} isDisabled={invalid}>Salvar agenda</Button>
      </div>
    </section>
  );
}
