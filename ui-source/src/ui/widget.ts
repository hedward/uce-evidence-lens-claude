import type { Assertion, Inspection, ToolOutput } from '../shared/inspection.js';
import { McpAppsBridge } from './bridge.js';
import { observeWidgetSize } from './size.js';

type UnknownRecord = Record<string, unknown>;

export interface WidgetController {
  setOutput(output: ToolOutput): void;
  destroy(): void;
}

export interface WidgetTransport {
  invoke(name: 'inspect_uce_record' | 'get_uce_inspection_report', reference: string): Promise<unknown>;
  subscribe?(listener: (value: unknown) => void): () => void;
  canOpenLink?(): boolean;
  openLink?(url: string): Promise<boolean>;
  canDownloadFile?(): boolean;
  downloadJson?(filename: string, contents: string): Promise<boolean>;
  label: 'MCP Apps' | 'Local preview';
}

function record(value: unknown): UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
}

function text(value: unknown, fallback = 'Not available'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function outputFrom(value: unknown): ToolOutput | undefined {
  const outer = record(value);
  const structured = record(outer.structuredContent);
  const candidate = Object.keys(structured).length ? structured : outer;
  const inspection = record(candidate.inspection);
  return typeof inspection.reference === 'string' ? candidate as unknown as ToolOutput : undefined;
}

function withoutMismatchedReport(output: ToolOutput): ToolOutput {
  if (!output.report) return output;
  const reportInspection = output.report.inspection;
  return reportInspection.reference === output.inspection.reference && reportInspection.checkedAt === output.inspection.checkedAt
    ? output
    : { inspection: output.inspection };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, content?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function labelledValue(label: string, value: unknown): HTMLElement {
  const item = el('div', 'fact');
  item.append(el('dt', undefined, label), el('dd', undefined, text(value)));
  return item;
}

function safeLensLink(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'uceevidencelens.com' && parsed.port === '' ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

function checkGroup(check: unknown): 'Format' | 'Hash' | 'Signature' | 'Other checks' {
  const item = record(check);
  if (item.id === 'canonical_manifest_hash') return 'Hash';
  if (item.id === 'platform_signature') return 'Signature';
  if (item.id === 'schema' || item.id === 'identifier' || item.id === 'retrieval_or_format') return 'Format';
  const haystack = [item.category, item.kind, item.id, item.name, item.label, item.check].filter(Boolean).join(' ').toLowerCase();
  if (/hash|digest|checksum/.test(haystack)) return 'Hash';
  if (/sign|key|cryptograph/.test(haystack)) return 'Signature';
  if (/format|pars|schema/.test(haystack)) return 'Format';
  return 'Other checks';
}

function renderCheck(check: unknown, tag: 'li' | 'article' = 'li'): HTMLElement {
  const item = record(check);
  const card = el(tag, 'check');
  const heading = el('div', 'check-heading');
  const chronology = record(item.chronologyProvenance);
  heading.append(
    el('strong', undefined, text(item.label ?? item.name ?? item.id ?? item.check, 'Check')),
    el('span', `result result-${text(item.status ?? item.result, 'unknown').toLowerCase().replace(/[^a-z]+/g, '-')}`, item.status === 'reported' && chronology.relationship === 'gateway_index' ? 'Gateway reported' : text(item.status ?? item.result, 'unknown')),
  );
  card.append(heading);
  const detail = item.explanation ?? item.summary ?? item.message ?? item.detail ?? item.limitation;
  if (detail !== undefined) card.append(el('p', 'muted', text(detail)));
  const metadata = el('dl', 'mini-facts');
  if (Object.keys(chronology).length) {
    const block = record(chronology.block);
    metadata.append(
      labelledValue('Reference type', chronology.referenceType === 'bundled_item' ? 'Bundled data item' : 'Top-level transaction'),
      labelledValue('Item identifier', chronology.transactionId),
      labelledValue('Root transaction', chronology.rootTransactionId),
      labelledValue('Parent path', Array.isArray(chronology.parentPath) ? chronology.parentPath.map(x => text(x)).join(' → ') : undefined),
      labelledValue('Block height', String(block.height)),
      labelledValue('Block timestamp (UTC)', block.timestamp),
      labelledValue('Relationship evidence', chronology.relationship === 'gateway_index' ? 'Gateway index metadata; cryptographic bundle inclusion not checked' : 'Direct membership in retrieved block metadata'),
    );
  }
  if (item.algorithm !== undefined) metadata.append(labelledValue('Algorithm', item.algorithm));
  if (item.coverage !== undefined) metadata.append(labelledValue('Coverage', item.coverage));
  if (item.executionContext !== undefined || item.context !== undefined) metadata.append(labelledValue('Context', item.executionContext ?? item.context));
  const hash = record(item.hashProvenance);
  if (Object.keys(hash).length) {
    metadata.append(
      labelledValue('Hash profile', hash.profile),
      labelledValue('Computed hash', hash.computedHash),
      labelledValue('Canonical bytes', hash.canonicalBytes),
      labelledValue('Hash coverage', hash.coverage),
      labelledValue('Publisher revision', hash.publisherRevision),
    );
  }
  const signature = record(item.signatureProvenance);
  if (Object.keys(signature).length) {
    metadata.append(
      labelledValue('Key ID', signature.keyId),
      labelledValue('Key thumbprint', signature.keyThumbprint),
      labelledValue('Public key source', signature.publicKeySource),
      labelledValue('Key review source', signature.keyReviewSource),
      labelledValue('Key reviewed', signature.reviewedAt),
    );
  }
  if (metadata.childElementCount) {
    const technical = el('details', 'technical');
    technical.append(el('summary', undefined, 'Technical provenance'), metadata);
    card.append(technical);
  }
  return card;
}

function renderChronology(inspection: Inspection): HTMLElement {
  const section = sectionNode('Chronology', 'Recorded dates and public transaction evidence are shown separately.');
  const list = el('ol', 'timeline');
  for (const raw of inspection.chronology.recorded) {
    const item = record(raw);
    const li = el('li');
    li.append(el('strong', undefined, text(item.label ?? item.kind ?? item.type, 'Recorded event')));
    li.append(el('span', 'mono muted', text(item.timestamp)));
    li.append(el('span', 'muted', `Source: ${text(item.source)}`));
    li.append(el('span', 'limit', text(item.limitation)));
    list.append(li);
  }
  for (const tx of inspection.chronology.transactions) {
    const li = el('li');
    li.append(el('strong', undefined, `${tx.kind === 'manifest' ? 'Manifest' : 'File'} transaction`));
    li.append(el('span', 'mono muted', text(tx.transactionId)));
    li.append(renderCheck(tx.check, 'article'));
    li.append(el('span', 'muted', tx.limitation));
    list.append(li);
  }
  if (!list.childElementCount) list.append(el('li', 'muted', 'No chronology was returned.'));
  section.append(list);
  return section;
}

function renderAssertion(assertion: Assertion): HTMLElement {
  const detail = el('details', 'disclosure');
  const summary = el('summary');
  summary.append(el('span', undefined, assertion.label), el('span', 'tag', assertion.category));
  detail.append(summary);
  const body = el('div', 'disclosure-body');
  body.append(el('p', 'assertion-value', assertion.value));
  body.append(el('p', 'muted', `Source: ${assertion.source}`));
  body.append(el('p', 'limit', assertion.limitation));
  detail.append(body);
  return detail;
}

function sectionNode(title: string, intro?: string): HTMLElement {
  const section = el('section', 'section');
  section.append(el('h2', undefined, title));
  if (intro) section.append(el('p', 'section-intro', intro));
  return section;
}

function reportJson(output: ToolOutput): string {
  return JSON.stringify(output.report, null, 2);
}

function isHostActionTimeout(error: unknown): boolean {
  return error instanceof Error && /timed?\s*out|timeout/i.test(error.message);
}

export function createWidget(root: HTMLElement, transport: WidgetTransport): WidgetController {
  let current: ToolOutput | undefined;
  let generation = 0;
  let activeAction: { reference: string; generation: number; hostSnapshot?: ToolOutput } | undefined;
  const shell = el('main', 'lens');
  const header = el('header', 'hero');
  const headerContent = el('div');
  const statusLine = el('p', 'status-line');
  statusLine.setAttribute('role', 'status');
  statusLine.setAttribute('aria-live', 'polite');
  statusLine.setAttribute('aria-atomic', 'true');
  const bodyContent = el('div');
  header.append(headerContent, statusLine);
  shell.append(header, bodyContent);
  let unsubscribe = transport.subscribe?.((value) => {
    const next = outputFrom(value);
    if (!next) return;
    if (activeAction && activeAction.generation === generation && next.inspection.reference === activeAction.reference) {
      activeAction.hostSnapshot = next;
      setOutput(next, false);
      setActionButtonsDisabled(true);
      return;
    }
    setOutput(next);
  });

  function setActionButtonsDisabled(disabled: boolean): void {
    root.querySelectorAll<HTMLButtonElement>('button[data-action]').forEach((button) => { button.disabled = disabled; });
  }

  async function run(
    name: 'inspect_uce_record' | 'get_uce_inspection_report',
    initiatingAction: 'recheck' | 'report',
    initiatingButton: HTMLButtonElement,
  ): Promise<void> {
    if (!current) return;
    const requestedReference = current.inspection.reference;
    const requestedGeneration = generation;
    const action: { reference: string; generation: number; hostSnapshot?: ToolOutput } = {
      reference: requestedReference,
      generation: requestedGeneration,
    };
    activeAction = action;
    const ownerDocument = root.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    const actionHadFocus = ownerDocument.activeElement === initiatingButton;
    let userMovedFocus = false;
    let restoreFocus = false;
    const trackFocus = (event: FocusEvent) => {
      if (event.target !== initiatingButton) userMovedFocus = true;
    };
    const trackWindowBlur = () => { userMovedFocus = true; };
    if (actionHadFocus) ownerDocument.addEventListener('focusin', trackFocus);
    if (actionHadFocus) ownerWindow?.addEventListener('blur', trackWindowBlur);
    setActionButtonsDisabled(true);
    statusLine.textContent = name === 'inspect_uce_record' ? 'Checking again…' : 'Creating a fresh report…';
    try {
      const response = outputFrom(await transport.invoke(name, requestedReference));
      if (generation !== requestedGeneration) return;
      if (!response) throw new Error('The tool did not return an inspection.');
      if (response.inspection.reference !== requestedReference) throw new Error('The returned record does not match this view.');
      if (action.hostSnapshot && action.hostSnapshot.inspection.checkedAt !== response.inspection.checkedAt) {
        setActionButtonsDisabled(false);
        return;
      }
      setOutput(response, action.hostSnapshot === undefined);
      statusLine.textContent = name === 'inspect_uce_record' ? 'Inspection updated.' : 'Fresh report created.';
      restoreFocus = true;
    } catch (error) {
      if (generation !== requestedGeneration) return;
      statusLine.textContent = error instanceof Error ? error.message : 'The request failed.';
      setActionButtonsDisabled(false);
      restoreFocus = true;
    } finally {
      if (activeAction === action) activeAction = undefined;
      if (actionHadFocus) ownerDocument.removeEventListener('focusin', trackFocus);
      if (actionHadFocus) ownerWindow?.removeEventListener('blur', trackWindowBlur);
      if (actionHadFocus && !userMovedFocus && restoreFocus) {
        root.querySelector<HTMLButtonElement>(`button[data-action="${initiatingAction}"]`)?.focus();
      }
    }
  }

  function render(output: ToolOutput): void {
    const inspection = output.inspection;
    headerContent.replaceChildren();
    bodyContent.replaceChildren();
    const eyebrow = el('div', 'eyebrow');
    eyebrow.append(el('span', 'mark', 'UCE'), el('span', undefined, 'Evidence Lens'));
    if (transport.label === 'Local preview') eyebrow.append(el('span', 'preview-badge', 'Local preview'));
    headerContent.append(eyebrow, el('h1', undefined, text(inspection.record?.title, 'Record inspection')));
    headerContent.append(el('p', 'reference mono', inspection.reference));
    headerContent.append(el('p', 'summary', inspection.summary));

    const facts = el('dl', 'facts');
    facts.append(
      labelledValue('Inspection state', inspection.status),
      labelledValue('Performed', new Date(inspection.checkedAt).toLocaleString()),
      labelledValue('Execution', 'Server-performed'),
      labelledValue('Verifier', `${inspection.verifier.name} ${inspection.verifier.version}`),
    );
    headerContent.append(facts);
    const actions = el('div', 'actions');
    const recheck = el('button', 'button button-secondary', 'Check again');
    recheck.type = 'button'; recheck.dataset.action = 'recheck';
    recheck.addEventListener('click', () => void run('inspect_uce_record', 'recheck', recheck));
    const report = el('button', 'button', output.report ? 'Refresh report' : 'Get report');
    report.type = 'button'; report.dataset.action = 'report';
    report.addEventListener('click', () => void run('get_uce_inspection_report', 'report', report));
    actions.append(recheck, report);
    const lensUrl = safeLensLink(inspection.lensUrl);
    if (lensUrl) {
      const link = el('a', 'button button-link', 'Open in Evidence Lens');
      link.href = lensUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.addEventListener('click', (event) => {
        if (!transport.openLink || !transport.canOpenLink?.()) return;
        event.preventDefault();
        if (current === output && !activeAction) statusLine.textContent = 'Waiting for the host to confirm the Evidence Lens link request…';
        void transport.openLink(lensUrl).then((opened) => {
          if (current !== output || activeAction) return;
          statusLine.textContent = opened
            ? 'The Evidence Lens link request was sent to the host.'
            : 'The host did not confirm the Evidence Lens link request. The link remains available to copy.';
        }).catch((error: unknown) => {
          if (current !== output || activeAction) return;
          statusLine.textContent = isHostActionTimeout(error)
            ? 'The host did not confirm the Evidence Lens link request within two minutes. The link remains available to copy.'
            : 'The Evidence Lens link request was not confirmed by the host. The link remains available to copy.';
        });
      });
      actions.append(link);
    }
    if (transport.label === 'Local preview') {
      const change = el('button', 'button button-link', 'Change record');
      change.type = 'button';
      change.addEventListener('click', () => window.location.reload());
      actions.append(change);
    }
    headerContent.append(actions);

    const checks = sectionNode('Evidence checks', 'Each result reports its own scope. A check does not establish identity, authorship, ownership, rights, consent, or creation date.');
    const groups = new Map<string, unknown[]>([['Format', []], ['Hash', []], ['Signature', []], ['Other checks', []]]);
    for (const check of inspection.checks) groups.get(checkGroup(check))?.push(check);
    const grid = el('div', 'check-grid');
    for (const [title, items] of groups) {
      const group = el('article', 'check-group');
      group.append(el('h3', undefined, title));
      const list = el('ul', 'check-list');
      if (items.length) items.forEach((item) => list.append(renderCheck(item)));
      else list.append(el('li', 'check muted', 'No result returned.'));
      group.append(list); grid.append(group);
    }
    checks.append(grid);

    const coverage = sectionNode('Hash coverage', 'What the server recomputed from the manifest contents.');
    const coverageFacts = el('dl', 'facts compact');
    coverageFacts.append(labelledValue('Manifest contents', inspection.coverage.manifestContents));
    if (inspection.record?.manifestHash) coverageFacts.append(labelledValue('Manifest hash', inspection.record.manifestHash));
    if (inspection.record) coverageFacts.append(labelledValue('Files listed', String(inspection.record.fileCount)));
    coverage.append(coverageFacts);
    const coverageLimits = el('ul', 'limits');
    inspection.coverage.limitations.forEach((limit) => coverageLimits.append(el('li', undefined, limit)));
    if (coverageLimits.childElementCount) coverage.append(coverageLimits);

    bodyContent.append(checks, coverage, renderChronology(inspection));

    const assertions = sectionNode('Recorded assertions', 'These are statements recorded in the evidence, presented with their source and limitation.');
    if (inspection.assertions.length) inspection.assertions.forEach((item) => assertions.append(renderAssertion(item)));
    else assertions.append(el('p', 'muted', 'No recorded assertions were returned.'));
    bodyContent.append(assertions);

    const limits = sectionNode('Limits');
    limits.append(el('p', 'legal', inspection.legalNotice));
    limits.append(el('p', 'muted', 'This inspection concerns evidence integrity. It does not provide a legal conclusion or verify the truth of recorded claims.'));
    if (inspection.error) limits.append(el('p', 'error', `${inspection.error.message}${inspection.error.retryable ? ' You can try again.' : ''}`));
    bodyContent.append(limits);

    if (output.report) {
      const reportSection = sectionNode('Unsigned inspection report', output.report.datedSnapshotDisclaimer);
      const details = el('details', 'report-details');
      details.append(el('summary', undefined, 'View report JSON'));
      details.append(el('pre', 'report-json', reportJson(output)));
      reportSection.append(details);
      const download = el('button', 'button button-secondary', 'Download JSON');
      download.type = 'button';
      download.addEventListener('click', async () => {
        // Some embedded hosts silently disallow downloads. Always reveal a usable
        // text fallback; never claim that requesting a download saved a file.
        details.open = true;
        const json = reportJson(output);
        const filename = `uce-inspection-${inspection.reference.replace(/[^a-z0-9._-]+/gi, '-')}.json`;
        statusLine.textContent = 'The complete report JSON is open below.';
        if (transport.downloadJson && transport.canDownloadFile?.()) {
          download.disabled = true;
          statusLine.textContent = 'Waiting for the host to confirm the download request. The complete report JSON is open below.';
          try {
            const requested = await transport.downloadJson(filename, json);
            if (current !== output || activeAction) return;
            statusLine.textContent = requested
              ? 'The complete report JSON is open below. The download request was sent to the host.'
              : 'The host did not confirm the download request. The complete report JSON remains open below.';
          } catch (error: unknown) {
            if (current !== output || activeAction) return;
            statusLine.textContent = isHostActionTimeout(error)
              ? 'The host did not confirm the download request within two minutes. The complete report JSON remains open below.'
              : 'The download request was not confirmed by the host. The complete report JSON remains open below.';
          } finally {
            download.disabled = false;
          }
          return;
        }
        try {
          const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
          const anchor = el('a'); anchor.href = url; anchor.download = filename;
          anchor.hidden = true;
          root.append(anchor);
          anchor.click(); anchor.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1_000);
          statusLine.textContent = 'The complete report JSON is open below. A browser download was requested.';
        } catch {
          statusLine.textContent = 'Download is unavailable here. The report JSON is open below.';
        }
      });
      reportSection.append(download);
      bodyContent.append(reportSection);
    }
    if (shell.parentElement !== root) root.replaceChildren(shell);
  }

  function setOutput(output: ToolOutput, advanceGeneration = true): void {
    const safeOutput = withoutMismatchedReport(output);
    if (advanceGeneration) generation += 1;
    current = safeOutput;
    statusLine.textContent = '';
    render(safeOutput);
  }

  return { setOutput, destroy: () => { unsubscribe?.(); unsubscribe = undefined; } };
}

function localTransport(): WidgetTransport {
  return {
    label: 'Local preview',
    async invoke(name, reference) {
      const endpoint = name === 'inspect_uce_record' ? '/api/inspect' : '/api/report';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reference }),
      });
      if (!response.ok) throw new Error(`Preview request failed (${response.status}).`);
      return response.json();
    },
  };
}

export function mountWidget(root: HTMLElement = document.getElementById('app') ?? document.body): WidgetController {
  if (window.parent === window) {
    const transport = localTransport();
    const controller = createWidget(root, transport);
    const start = el('main', 'lens preview-start');
    start.append(el('div', 'preview-badge', 'Local preview'), el('h1', undefined, 'Inspect a public UCE record'));
    const form = el('form', 'preview-form');
    const label = el('label', undefined, 'Public record reference');
    const input = el('input'); input.name = 'reference'; input.required = true; input.autocomplete = 'off';
    label.append(input);
    const submit = el('button', 'button', 'Inspect'); submit.type = 'submit';
    const status = el('p', 'status-line'); status.setAttribute('role', 'status');
    form.append(label, submit, status);
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); submit.disabled = true; status.textContent = 'Inspecting…';
      try {
        const result = outputFrom(await transport.invoke('inspect_uce_record', input.value));
        if (!result) throw new Error('The preview server returned no inspection.');
        controller.setOutput(result);
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : 'The request failed.';
        submit.disabled = false;
      }
    });
    start.append(form); root.replaceChildren(start);
    return controller;
  }

  const bridge = new McpAppsBridge();
  const waiting = el('main', 'lens preview-start');
  waiting.append(el('div', 'eyebrow', 'UCE Evidence Lens'));
  waiting.append(el('h1', undefined, 'Loading record inspection'));
  const waitingStatus = el('p', 'status-line', 'Connecting to the host…');
  waitingStatus.setAttribute('role', 'status');
  waitingStatus.setAttribute('aria-live', 'polite');
  waitingStatus.setAttribute('aria-atomic', 'true');
  const retryConnection = el('button', 'button button-secondary', 'Retry connection');
  retryConnection.type = 'button';
  retryConnection.hidden = true;
  waiting.append(waitingStatus, retryConnection);
  root.replaceChildren(waiting);
  const transport: WidgetTransport = {
    label: 'MCP Apps',
    invoke: (name, reference) => bridge.callTool(name, reference),
    subscribe: (listener) => bridge.onToolResult((result) => listener(result)),
    canOpenLink: () => bridge.canOpenLinks(),
    openLink: (url) => bridge.openLink(url),
    canDownloadFile: () => bridge.canDownloadFile(),
    downloadJson: (filename, contents) => bridge.downloadJson(filename, contents),
  };
  const controller = createWidget(root, transport);
  let stopSizing = (): void => {};
  let sizingStarted = false;
  let destroyed = false;
  const connect = async (): Promise<void> => {
    if (destroyed) return;
    retryConnection.disabled = true;
    retryConnection.hidden = true;
    waitingStatus.textContent = 'Connecting to the host…';
    try {
      await bridge.connect();
      if (destroyed) return;
      if (!sizingStarted) {
        sizingStarted = true;
        stopSizing = observeWidgetSize(root, (width, height) => bridge.notifySize(width, height));
      }
      waitingStatus.textContent = 'Connected. Waiting for inspection data…';
    } catch {
      if (destroyed || !waiting.isConnected) return;
      waitingStatus.textContent = 'Could not connect this view to its host.';
      retryConnection.disabled = false;
      retryConnection.hidden = false;
    }
  };
  retryConnection.addEventListener('click', () => void connect());
  void connect();
  return {
    setOutput: controller.setOutput,
    destroy: () => { destroyed = true; stopSizing(); controller.destroy(); bridge.destroy(); },
  };
}
