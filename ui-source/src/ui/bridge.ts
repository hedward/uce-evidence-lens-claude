import {
  App,
  LATEST_PROTOCOL_VERSION,
  PostMessageTransport,
  applyDocumentTheme,
  type McpUiHostContext,
  type McpUiToolResultNotification,
} from '@modelcontextprotocol/ext-apps';

export const MCP_APPS_PROTOCOL_VERSION = LATEST_PROTOCOL_VERSION;
const INITIALIZE_TIMEOUT_MS = 15_000;
const TOOL_TIMEOUT_MS = 40_000;
const HOST_ACTION_TIMEOUT_MS = 120_000;

type ToolName = 'inspect_uce_record' | 'get_uce_inspection_report';
export type ToolResultNotification = McpUiToolResultNotification['params'];

function safeFilename(filename: string): string {
  const cleaned = filename.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'uce-inspection.json';
}

export class McpAppsBridge {
  readonly #app: App;
  readonly #parentWindow: Window;
  readonly #listeners = new Set<(result: ToolResultNotification) => void>();
  #connected = false;
  #connecting: Promise<void> | undefined;
  #destroyed = false;

  constructor(parentWindow: Window = window.parent) {
    this.#parentWindow = parentWindow;
    this.#app = new App(
      { name: 'uce-evidence-lens', title: 'UCE Evidence Lens', version: '0.1.0' },
      {},
      { autoResize: false, strict: true },
    );
    this.#app.addEventListener('toolresult', this.#onToolResult);
    this.#app.addEventListener('hostcontextchanged', this.#onHostContextChanged);
  }

  get connected(): boolean {
    return this.#connected;
  }

  connect(): Promise<void> {
    if (this.#destroyed) return Promise.reject(new Error('MCP Apps bridge closed.'));
    if (this.#connected) return Promise.resolve();
    if (this.#connecting) return this.#connecting;
    let attempt!: Promise<void>;
    attempt = this.#initialize().finally(() => {
      if (this.#connecting === attempt) this.#connecting = undefined;
    });
    this.#connecting = attempt;
    return attempt;
  }

  async #initialize(): Promise<void> {
    try {
      await this.#app.connect(
        new PostMessageTransport(this.#parentWindow, this.#parentWindow),
        { timeout: INITIALIZE_TIMEOUT_MS },
      );
    } catch (error) {
      await this.#app.close().catch(() => undefined);
      if (this.#destroyed) throw new Error('MCP Apps bridge closed.');
      throw error;
    }
    if (this.#destroyed) {
      await this.#app.close().catch(() => undefined);
      throw new Error('MCP Apps bridge closed.');
    }
    this.#connected = true;
    this.#applyHostTheme(this.#app.getHostContext());
  }

  onToolResult(listener: (result: ToolResultNotification) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async callTool(name: ToolName, reference: string): Promise<unknown> {
    this.#assertConnected();
    if (!this.#app.getHostCapabilities()?.serverTools) {
      throw new Error('This host does not support app-initiated tool calls.');
    }
    return this.#app.callServerTool(
      { name, arguments: { reference } },
      { timeout: TOOL_TIMEOUT_MS },
    );
  }

  canOpenLinks(): boolean {
    return this.#connected && Boolean(this.#app.getHostCapabilities()?.openLinks);
  }

  async openLink(url: string): Promise<boolean> {
    if (!this.canOpenLinks()) return false;
    const result = await this.#app.openLink({ url }, { timeout: HOST_ACTION_TIMEOUT_MS });
    return result.isError !== true;
  }

  canDownloadFile(): boolean {
    return this.#connected && Boolean(this.#app.getHostCapabilities()?.downloadFile);
  }

  async downloadJson(filename: string, contents: string): Promise<boolean> {
    if (!this.canDownloadFile()) return false;
    const name = safeFilename(filename);
    const result = await this.#app.downloadFile({
      contents: [{
        type: 'resource',
        resource: {
          uri: `file:///${encodeURIComponent(name)}`,
          mimeType: 'application/json',
          text: contents,
        },
      }],
    }, { timeout: HOST_ACTION_TIMEOUT_MS });
    return result.isError !== true;
  }

  notifySize(width: number, height: number): void {
    if (!this.#connected || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    void this.#app.sendSizeChanged({ width: Math.ceil(width), height: Math.ceil(height) }).catch(() => undefined);
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#connected = false;
    this.#app.removeEventListener('toolresult', this.#onToolResult);
    this.#app.removeEventListener('hostcontextchanged', this.#onHostContextChanged);
    this.#listeners.clear();
    void this.#app.close().catch(() => undefined);
  }

  readonly #onToolResult = (result: ToolResultNotification): void => {
    for (const listener of this.#listeners) listener(result);
  };

  readonly #onHostContextChanged = (context: McpUiHostContext): void => {
    this.#applyHostTheme(context);
  };

  #applyHostTheme(context: McpUiHostContext | undefined): void {
    if (context?.theme) applyDocumentTheme(context.theme);
  }

  #assertConnected(): void {
    if (this.#destroyed) throw new Error('MCP Apps bridge closed.');
    if (!this.#connected) throw new Error('MCP Apps bridge is not connected.');
  }
}
