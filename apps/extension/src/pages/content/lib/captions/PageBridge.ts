/**
 * @purpose 内容脚本侧的页面桥接客户端：用自定义事件向注入脚本请求字幕轨与字幕文档。
 * @role    BridgeCaptionSource 与 SubtitleTransport 的底层通道。
 * @deps    public/scripts/inject-youtube.js、CustomEvent、subtitleDebug
 * @gotcha  请求靠 requestId 配对且有超时（BRIDGE_TIMEOUT）；事件名改了要同步注入脚本
 */
import { subtitleDebug } from "../subtitle-domain/subtitleDebug";

type BasePageBridgeRequest = {
  requestId: string;
};

type PageBridgeResponse = {
  requestId: string;
  ok: boolean;
  payload?: unknown;
  error?: string;
};

type ListCaptionTracksRequest = BasePageBridgeRequest;

type FetchSubtitleDocumentRequest = BasePageBridgeRequest & {
  url: string;
};

export interface PageBridgeSubtitleDocumentPayload {
  status: number;
  statusText: string;
  contentType: string | null;
  content: string;
}

const LIST_REQUEST_EVENT = "listenup:list-caption-tracks:request";
const LIST_RESPONSE_EVENT = "listenup:list-caption-tracks:response";
const FETCH_REQUEST_EVENT = "listenup:fetch-subtitle-document:request";
const FETCH_RESPONSE_EVENT = "listenup:fetch-subtitle-document:response";

export class PageBridge {
  private injected = false;
  private injectPromise: Promise<void> | null = null;

  private injectScript(): Promise<void> {
    if (this.injected) {
      return Promise.resolve();
    }

    if (this.injectPromise) {
      return this.injectPromise;
    }

    this.injectPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("./scripts/inject-youtube.js");
      script.dataset.listenupBridge = "true";
      script.onload = () => {
        subtitleDebug.log("bridge script loaded");
        script.remove();
        this.injected = true;
        this.injectPromise = null;
        resolve();
      };
      script.onerror = () => {
        subtitleDebug.error("bridge script failed to load");
        script.remove();
        this.injectPromise = null;
        reject(new Error("Failed to load bridge script"));
      };

      subtitleDebug.log("inject bridge script", script.src);
      (document.head || document.documentElement).appendChild(script);
    });

    return this.injectPromise;
  }

  public async listCaptionTracks(timeoutMs = 3000): Promise<unknown> {
    await this.injectScript();

    return await this.dispatchRequest<ListCaptionTracksRequest>({
      requestEvent: LIST_REQUEST_EVENT,
      responseEvent: LIST_RESPONSE_EVENT,
      timeoutMs,
      request: {
        requestId: this.createRequestId(),
      },
    });
  }

  public async fetchSubtitleDocument(
    url: string,
    timeoutMs = 5000
  ): Promise<PageBridgeSubtitleDocumentPayload> {
    await this.injectScript();

    return await this.dispatchRequest<FetchSubtitleDocumentRequest>({
      requestEvent: FETCH_REQUEST_EVENT,
      responseEvent: FETCH_RESPONSE_EVENT,
      timeoutMs,
      request: {
        requestId: this.createRequestId(),
        url,
      },
    }) as PageBridgeSubtitleDocumentPayload;
  }

  private createRequestId() {
    return `listenup_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  private async dispatchRequest<TRequest extends BasePageBridgeRequest>(input: {
    requestEvent: string;
    responseEvent: string;
    timeoutMs: number;
    request: TRequest;
  }): Promise<unknown> {
    return await new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout);
        window.removeEventListener(
          input.responseEvent,
          onResponse as EventListener
        );
      };

      const onResponse = (event: CustomEvent<PageBridgeResponse>) => {
        const data = event.detail;
        if (!data || data.requestId !== input.request.requestId) {
          return;
        }

        cleanup();
        subtitleDebug.log("bridge response received", data);

        if (!data.ok) {
          reject(new Error(data.error || "Bridge request failed"));
          return;
        }

        resolve(data.payload);
      };

      const timeout = window.setTimeout(() => {
        cleanup();
        subtitleDebug.error("bridge request timed out", {
          requestId: input.request.requestId,
          timeoutMs: input.timeoutMs,
          requestEvent: input.requestEvent,
        });
        reject(new Error("Bridge request timed out"));
      }, input.timeoutMs);

      window.addEventListener(
        input.responseEvent,
        onResponse as EventListener
      );

      subtitleDebug.log("post bridge request", {
        requestEvent: input.requestEvent,
        ...input.request,
      });
      window.dispatchEvent(
        new CustomEvent<TRequest>(input.requestEvent, {
          detail: input.request,
        })
      );
    });
  }
}

export const pageBridge = new PageBridge();
