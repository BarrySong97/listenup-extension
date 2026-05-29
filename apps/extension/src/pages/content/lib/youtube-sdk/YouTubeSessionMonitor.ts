export interface YouTubeSessionState {
  videoId: string | null;
  isWatchPage: boolean;
  isPlayerReady: boolean;
}

type SessionListener = (state: YouTubeSessionState) => void;

export class YouTubeSessionMonitor {
  private state: YouTubeSessionState = {
    videoId: null,
    isWatchPage: false,
    isPlayerReady: false,
  };

  private listeners = new Set<SessionListener>();
  private observer: MutationObserver | null = null;
  private originalPushState = history.pushState;
  private originalReplaceState = history.replaceState;
  private started = false;
  private readonly notify = () => {
    this.emit();
  };

  private parseVideoId() {
    const match = window.location.search.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
  }

  private isWatchPage() {
    return window.location.pathname === "/watch";
  }

  private isPlayerReady() {
    return Boolean(document.querySelector("#movie_player video, #movie_player"));
  }

  private emit() {
    const nextState: YouTubeSessionState = {
      videoId: this.isWatchPage() ? this.parseVideoId() : null,
      isWatchPage: this.isWatchPage(),
      isPlayerReady: this.isPlayerReady(),
    };

    const changed =
      nextState.videoId !== this.state.videoId ||
      nextState.isWatchPage !== this.state.isWatchPage ||
      nextState.isPlayerReady !== this.state.isPlayerReady;

    this.state = nextState;

    if (changed) {
      this.listeners.forEach((listener) => listener(this.state));
    }
  }

  public start() {
    if (this.started) {
      this.emit();
      return;
    }

    this.started = true;

    this.observer = new MutationObserver(() => {
      this.emit();
    });
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    history.pushState = (...args) => {
      this.originalPushState.apply(history, args);
      this.notify();
    };

    history.replaceState = (...args) => {
      this.originalReplaceState.apply(history, args);
      this.notify();
    };

    window.addEventListener("popstate", this.notify);
    window.addEventListener("yt-navigate-finish", this.notify);
    this.emit();
  }

  public stop() {
    if (!this.started) {
      return;
    }

    this.started = false;
    this.observer?.disconnect();
    this.observer = null;
    history.pushState = this.originalPushState;
    history.replaceState = this.originalReplaceState;
    window.removeEventListener("popstate", this.notify);
    window.removeEventListener("yt-navigate-finish", this.notify);
  }

  public getState() {
    return this.state;
  }

  public subscribe(listener: SessionListener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
