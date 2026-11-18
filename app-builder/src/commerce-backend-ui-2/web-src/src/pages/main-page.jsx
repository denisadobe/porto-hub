import { useEffect, useMemo, useState } from "react";
import {
  Content, Heading, InlineAlert, ProgressCircle, Tab, TabList, TabPanel, Tabs, ToastContainer, ToastQueue,
} from "@react-spectrum/s2";
import { adminApi, useCredentials } from "../api.js";
import { BookingsTab } from "./bookings-tab.jsx";
import { CoverageTab } from "./coverage-tab.jsx";
import { AgendaTab } from "./agenda-tab.jsx";

function notify(message, variant = "positive") {
  const show = variant === "negative" ? ToastQueue.negative : ToastQueue.positive;
  show(message, { timeout: 5000 });
}

/** Porto Serviço admin page: Agendamentos, Cobertura and Agenda tabs. */
export function MainPage() {
  const credentials = useCredentials();
  const api = useMemo(() => (credentials ? adminApi(credentials) : null), [credentials?.token, credentials?.org]);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!api) return;
    api.getConfig().then(setConfig).catch((e) => setError(e.message));
  }, [api]);

  if (!credentials) {
    return (
      <main className="ps-page">
        <InlineAlert variant="notice">
          <Heading>Abra esta página pelo Admin do Commerce</Heading>
          <Content>O app usa o login do Admin para acessar a agenda e a cobertura.</Content>
        </InlineAlert>
      </main>
    );
  }

  return (
    <main className="ps-page">
      <header className="ps-header">
        <Heading level={1}>Porto Serviço</Heading>
        <p className="ps-muted">Cobertura por CEP, agenda de atendimento e agendamentos dos serviços vendidos no site.</p>
      </header>
      {error && (
        <InlineAlert variant="negative">
          <Heading>Não foi possível carregar a configuração</Heading>
          <Content>{error}</Content>
        </InlineAlert>
      )}
      {!config && !error && <ProgressCircle aria-label="Carregando" isIndeterminate />}
      {config && (
        <Tabs aria-label="Porto Serviço" defaultSelectedKey="bookings">
          <TabList>
            <Tab id="bookings">Agendamentos</Tab>
            <Tab id="coverage">Cobertura</Tab>
            <Tab id="agenda">Agenda</Tab>
          </TabList>
          <TabPanel id="bookings">
            <BookingsTab api={api} notify={notify} />
          </TabPanel>
          <TabPanel id="coverage">
            <CoverageTab
              api={api}
              coverage={config.coverage}
              notify={notify}
              onSaved={(coverage) => setConfig((c) => ({ ...c, coverage }))}
            />
          </TabPanel>
          <TabPanel id="agenda">
            <AgendaTab
              api={api}
              agenda={config.agenda}
              notify={notify}
              onSaved={(agenda) => setConfig((c) => ({ ...c, agenda }))}
            />
          </TabPanel>
        </Tabs>
      )}
      <ToastContainer placement="bottom" />
    </main>
  );
}
