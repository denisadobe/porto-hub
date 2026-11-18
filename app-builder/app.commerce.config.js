import { defineConfig } from "@adobe/aio-commerce-lib-app/config";
import { MENU_SALES } from "@adobe/aio-commerce-lib-admin-ui/menu";

export default defineConfig({
  metadata: {
    id: "porto-servico",
    displayName: "Porto Serviço",
    description: "Cobertura por CEP, agenda de atendimento e agendamentos dos serviços Porto Serviço.",
    version: "1.0.0",
  },
  adminUi: {
    menu: {
      id: "porto_servico_agenda",
      label: "Porto Serviço",
      description: "Gerencie a cobertura por CEP, a agenda de atendimento e os agendamentos.",
      parentMenu: MENU_SALES,
      pageTitle: "Porto Serviço",
    },
    order: {
      gridColumns: {
        label: "Agendamento do serviço",
        description: "Mostra a data e o turno agendados de cada pedido.",
        runtimeAction: "porto-servico-admin/order-grid-booking",
        columns: [
          { id: "porto_booking", label: "Agendamento", type: "string", align: "left" },
          { id: "porto_booking_status", label: "Status do agendamento", type: "string", align: "left" },
        ],
      },
    },
  },
});
