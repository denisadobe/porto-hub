import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionButton, AlertDialog, Button, DialogTrigger, InlineAlert, Heading, Content,
  Picker, PickerItem, ProgressCircle, SearchField, StatusLight, Text,
} from "@react-spectrum/s2";
import { formatCep, longDate } from "../api.js";

const STATUS = {
  confirmed: { label: "Confirmado", variant: "positive" },
  held: { label: "Reservado", variant: "notice" },
};

function expiresIn(iso) {
  const min = Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60000));
  return `expira em ${min} min`;
}

/** Agendamentos: held and confirmed bookings, with release. */
export function BookingsTab({ api, notify }) {
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setBookings((await api.listBookings()).bookings);
    } catch (e) {
      setError(e.message);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => (bookings || [])
    .filter((b) => status === "all" || b.status === status)
    .filter((b) => {
      const q = query.replace(/\D/g, "") || query.trim().toLowerCase();
      if (!q) return true;
      return [b.cep, b.orderId, b.sku, b.region?.name].some((v) => String(v || "").toLowerCase().includes(q));
    }), [bookings, status, query]);

  const release = async (b) => {
    try {
      await api.releaseBooking(b.id);
      notify(`Horário de ${longDate(b.date)} (${b.shift.label}) liberado.`);
      load();
    } catch (e) {
      notify(e.message, "negative");
    }
  };

  const counts = (bookings || []).reduce((acc, b) => ({ ...acc, [b.status]: (acc[b.status] || 0) + 1 }), {});

  return (
    <section className="ps-tab">
      <div className="ps-toolbar">
        <SearchField label="Buscar" placeholder="CEP, pedido, serviço ou região" value={query} onChange={setQuery} />
        <Picker label="Status" selectedKey={status} onSelectionChange={setStatus}>
          <PickerItem id="all">Todos</PickerItem>
          <PickerItem id="confirmed">Confirmados</PickerItem>
          <PickerItem id="held">Reservados (aguardando pagamento)</PickerItem>
        </Picker>
        <ActionButton onPress={load}>Atualizar</ActionButton>
      </div>

      {bookings && (
        <p className="ps-summary">
          {counts.confirmed || 0} confirmados · {counts.held || 0} reservados aguardando pagamento.
          {" "}Reservas sem pedido expiram sozinhas.
        </p>
      )}

      {error && (
        <InlineAlert variant="negative">
          <Heading>Não foi possível carregar os agendamentos</Heading>
          <Content>{error}</Content>
        </InlineAlert>
      )}

      {!bookings && !error && <ProgressCircle aria-label="Carregando agendamentos" isIndeterminate />}

      {bookings && (
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Turno</th>
                <th>Região</th>
                <th>CEP</th>
                <th>Serviço</th>
                <th>Pedido</th>
                <th>Status</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan="8" className="ps-empty">Nenhum agendamento encontrado.</td></tr>
              )}
              {rows.map((b) => (
                <tr key={b.id}>
                  <td className="ps-nowrap">{longDate(b.date)}</td>
                  <td className="ps-nowrap">{b.shift?.label} <Text UNSAFE_className="ps-muted">{b.shift?.window}</Text></td>
                  <td>{b.region?.name}</td>
                  <td className="ps-nowrap">{formatCep(b.cep)}</td>
                  <td>{b.sku}</td>
                  <td>{b.orderId || <span className="ps-muted">—</span>}</td>
                  <td className="ps-nowrap">
                    <StatusLight variant={STATUS[b.status]?.variant || "neutral"}>
                      {STATUS[b.status]?.label || b.status}
                    </StatusLight>
                    {b.status === "held" && b.expiresAt && <div className="ps-muted ps-small">{expiresIn(b.expiresAt)}</div>}
                  </td>
                  <td className="ps-actions">
                    <DialogTrigger>
                      <Button variant="secondary" fillStyle="outline" size="S">Liberar</Button>
                      <AlertDialog
                        title="Liberar este horário?"
                        variant="destructive"
                        primaryActionLabel="Liberar"
                        cancelLabel="Cancelar"
                        onPrimaryAction={() => release(b)}
                      >
                        {`${longDate(b.date)}, ${b.shift?.label} (${b.shift?.window}) volta para a agenda.`}
                        {b.orderId ? ` O pedido ${b.orderId} não é cancelado no Commerce.` : ""}
                      </AlertDialog>
                    </DialogTrigger>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
