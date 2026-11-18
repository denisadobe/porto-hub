import { useState } from "react";
import {
  ActionButton, Button, InlineAlert, Heading, Content, Switch, TextArea, TextField,
} from "@react-spectrum/s2";
import { formatCep, testCoverage } from "../api.js";

const slug = (text) => String(text || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  .slice(0, 40) || `regiao-${Date.now()}`;

/** "01000000-05999999" lines <-> [{from, to}] */
const rangesToText = (ranges) => ranges.map((r) => `${formatCep(r.from)} a ${formatCep(r.to)}`).join("\n");
function textToRanges(text) {
  return String(text || "").split(/\n|;/).map((line) => {
    const [from, to] = (line.match(/\d{5}-?\d{3}/g) || []).map((c) => c.replace("-", ""));
    return from ? { from, to: to || from } : null;
  }).filter(Boolean);
}

function toDraft(coverage) {
  return coverage.regions.map((r) => ({
    ...r,
    rangesText: rangesToText(r.ranges),
    servicesText: r.services.includes("*") ? "" : r.services.join(", "),
  }));
}

function fromDraft(draft) {
  return {
    regions: draft.map((r) => ({
      id: r.id || slug(r.name),
      name: r.name.trim(),
      active: r.active,
      ranges: textToRanges(r.rangesText),
      services: r.servicesText.trim() ? r.servicesText.split(/[,\s]+/).filter(Boolean) : ["*"],
    })),
  };
}

function CepTester() {
  const [cep, setCep] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      setResult(await testCoverage(cep.replace(/\D/g, "")));
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ps-card ps-tester">
      <Heading level={3}>Testar CEP</Heading>
      <p className="ps-muted">Mostra o que o cliente vê no site (considera a configuração salva).</p>
      <div className="ps-row">
        <TextField label="CEP" value={cep} onChange={(v) => setCep(formatCep(v))} placeholder="00000-000" />
        <Button variant="primary" onPress={run} isPending={busy} isDisabled={cep.replace(/\D/g, "").length !== 8}>Testar</Button>
      </div>
      {result && (
        <p className={`ps-result ${result.served ? "is-ok" : "is-warn"}`}>
          {result.error || result.message}
          {result.address?.street ? ` (${result.address.street}, ${result.address.neighborhood} - ${result.address.city}/${result.address.state})` : ""}
        </p>
      )}
    </div>
  );
}

/** Cobertura: regions, CEP ranges and services. */
export function CoverageTab({ api, coverage, onSaved, notify }) {
  const [draft, setDraft] = useState(() => toDraft(coverage));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (i, patch) => setDraft((d) => d.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const add = () => setDraft((d) => [...d, {
    id: "", name: "Nova região", active: true, rangesText: "", servicesText: "", ranges: [], services: ["*"],
  }]);
  const remove = (i) => setDraft((d) => d.filter((_, j) => j !== i));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const { coverage: saved } = await api.saveCoverage(fromDraft(draft));
      setDraft(toDraft(saved));
      onSaved(saved);
      notify("Cobertura salva. O site já usa a nova configuração.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="ps-tab">
      <p className="ps-muted">
        O cliente informa o CEP na página do serviço. Ele é atendido quando o CEP está numa faixa de uma região ativa
        e a região oferece o serviço (deixe “Serviços” em branco para todos).
      </p>
      <CepTester />
      {error && (
        <InlineAlert variant="negative"><Heading>Não foi possível salvar</Heading><Content>{error}</Content></InlineAlert>
      )}
      <div className="ps-grid">
        {draft.map((r, i) => (
          <div className={`ps-card ${r.active ? "" : "is-off"}`} key={r.id || `new-${i}`}>
            <div className="ps-card-head">
              <TextField label="Região" value={r.name} onChange={(name) => update(i, { name })} isRequired />
              <Switch isSelected={r.active} onChange={(active) => update(i, { active })}>{r.active ? "Ativa" : "Inativa"}</Switch>
            </div>
            <TextArea
              label="Faixas de CEP"
              description="Uma faixa por linha, ex.: 01000-000 a 05999-999"
              value={r.rangesText}
              onChange={(rangesText) => update(i, { rangesText })}
            />
            <TextField
              label="Serviços (SKUs)"
              description="Em branco = todos os serviços. Ex.: ADB201, ADB220"
              value={r.servicesText}
              onChange={(servicesText) => update(i, { servicesText })}
            />
            <ActionButton onPress={() => remove(i)}>Remover região</ActionButton>
          </div>
        ))}
      </div>
      <div className="ps-footer">
        <ActionButton onPress={add}>Adicionar região</ActionButton>
        <Button variant="accent" onPress={save} isPending={saving}>Salvar cobertura</Button>
      </div>
    </section>
  );
}
