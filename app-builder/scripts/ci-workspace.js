/*
 * CI helper: reads the Developer Console workspace JSON ("Download all") from the
 * AIO_WORKSPACE_JSON env var, writes it to the given file for `aio app use`, and exports the
 * OAuth Server-to-Server credential as masked step outputs for adobe/aio-apps-action.
 * Usage: node scripts/ci-workspace.js <output-file>
 */
const fs = require('fs');

function fail(message) {
  console.log(`::error::${message}`);
  process.exit(1);
}

const raw = process.env.AIO_WORKSPACE_JSON;
if (!raw || !raw.trim()) {
  fail('Secret AIO_STAGE_WORKSPACE_JSON is missing. Add it in GitHub: Settings > Secrets and variables > Actions.');
}

let json;
try {
  json = JSON.parse(raw);
} catch (e) {
  fail('Secret AIO_STAGE_WORKSPACE_JSON is not valid JSON. Paste the whole file from Developer Console > Stage > Download all.');
}

const project = json.project || {};
const workspace = project.workspace || {};
const details = workspace.details || {};
const namespace = details.runtime?.namespaces?.[0];
if (!namespace?.name) fail('The workspace JSON has no Runtime namespace. Add Runtime to the Stage workspace and download it again.');

const credential = (details.credentials || []).find((c) => c.oauth_server_to_server)?.oauth_server_to_server;
if (!credential) {
  fail('The workspace JSON has no OAuth Server-to-Server credential. Add an API with OAuth Server-to-Server to the Stage workspace and download it again.');
}
const secret = (credential.client_secrets || [])[0] || credential.client_secret;
if (!secret) fail('The OAuth Server-to-Server credential in the workspace JSON has no client secret.');

const out = process.argv[2];
if (!out) fail('Missing output file argument.');
fs.writeFileSync(out, raw, { mode: 0o600 });

const outputs = {
  client_id: credential.client_id,
  client_secret: secret,
  technical_account_id: credential.technical_account_id,
  technical_account_email: credential.technical_account_email,
  ims_org_id: project.org?.ims_org_id,
  scopes: (credential.scopes || []).join(','),
  namespace: namespace.name,
  workspace: workspace.name,
};

['client_secret', 'client_id', 'technical_account_id', 'technical_account_email'].forEach((k) => {
  if (outputs[k]) console.log(`::add-mask::${outputs[k]}`);
});
if (namespace.auth) console.log(`::add-mask::${namespace.auth}`);

const lines = Object.entries(outputs).map(([k, v]) => `${k}=${v ?? ''}`).join('\n');
fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines}\n`);
console.log(`Workspace "${outputs.workspace}" (project "${project.title || project.name}"), namespace ${outputs.namespace}`);
