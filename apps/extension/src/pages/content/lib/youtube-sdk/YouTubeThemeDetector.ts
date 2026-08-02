/**
 * @purpose YouTube 明暗主题探测与对应配色。
 * @role    SDK 子组件，面板据此切换观感。
 * @deps    document 上的 YouTube 主题标记
 * @gotcha  主题变化是异步的，务必用回调而不是只在挂载时读一次
 */
/**
 * YouTube Theme Detector
 * Detects and monitors YouTube's theme (dark/light mode)
 */

export type YouTubeTheme = 'dark' | 'light';
export type ThemeChangeCallback = (theme: YouTubeTheme) => void;

export class YouTubeThemeDetector {
  private currentTheme: YouTubeTheme = 'light';
  private callback: ThemeChangeCallback | null = null;
  private observer: MutationObserver | null = null;
  private mediaQueryListener: MediaQueryList | null = null;

  /**
   * Detect current YouTube theme
   */
  public detectTheme(): YouTubeTheme {
    // Method 1: Check html element's dark attribute (most reliable)
    const htmlElement = document.documentElement;
    if (htmlElement.hasAttribute('dark')) {
      this.currentTheme = 'dark';
      return 'dark';
    }

    // Method 2: Check ytd-app element
    const ytdApp = document.querySelector('ytd-app');
    if (ytdApp) {
      // Check for dark theme class or attribute
      const isDark = ytdApp.classList.contains('dark-theme') || 
                    ytdApp.hasAttribute('dark');
      if (isDark) {
        this.currentTheme = 'dark';
        return 'dark';
      }
    }

    // Method 3: Check CSS variable (fallback)
    const computedStyle = window.getComputedStyle(document.documentElement);
    const bgColor = computedStyle.getPropertyValue('--yt-spec-base-background');
    if (bgColor && bgColor.includes('0, 0, 0')) {
      this.currentTheme = 'dark';
      return 'dark';
    }

    // Default to light
    this.currentTheme = 'light';
    return 'light';
  }

  /**
   * Start monitoring theme changes
   */
  public startMonitoring(): void {
    // Stop any existing monitoring
    this.stopMonitoring();

    // Initial detection
    this.detectAndNotify();

    // Setup MutationObserver for DOM changes
    this.observer = new MutationObserver((mutations) => {
      let shouldCheck = false;

      for (const mutation of mutations) {
        // Check HTML element attribute changes
        if (mutation.type === 'attributes' && 
            mutation.target === document.documentElement &&
            mutation.attributeName === 'dark') {
          shouldCheck = true;
          break;
        }

        // Check ytd-app changes
        if (mutation.type === 'attributes' && 
            (mutation.target as Element).tagName === 'YTD-APP') {
          shouldCheck = true;
          break;
        }
      }

      if (shouldCheck) {
        // Delay slightly to ensure DOM is fully updated
        setTimeout(() => this.detectAndNotify(), 50);
      }
    });

    // Observe HTML element
    this.observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['dark', 'class']
    });

    // Observe ytd-app if it exists
    const ytdApp = document.querySelector('ytd-app');
    if (ytdApp) {
      this.observer.observe(ytdApp, {
        attributes: true,
        attributeFilter: ['dark', 'class', 'style']
      });
    }

    // Listen for system theme changes
    this.mediaQueryListener = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQueryListener.addEventListener('change', () => {
      setTimeout(() => this.detectAndNotify(), 100);
    });
  }

  /**
   * Stop monitoring theme changes
   */
  public stopMonitoring(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.mediaQueryListener) {
      // Note: removeEventListener not needed with MediaQueryList in modern browsers
      this.mediaQueryListener = null;
    }
  }

  /**
   * Set callback for theme changes
   */
  public setCallback(callback: ThemeChangeCallback | null): void {
    this.callback = callback;
  }

  /**
   * Detect theme and notify if changed
   */
  private detectAndNotify(): void {
    const newTheme = this.detectTheme();
    
    if (newTheme !== this.currentTheme || this.callback) {
      this.currentTheme = newTheme;
      if (this.callback) {
        this.callback(newTheme);
      }
    }
  }

  /**
   * Get current theme
   */
  public getCurrentTheme(): YouTubeTheme {
    return this.currentTheme;
  }

  /**
   * Check if current theme is dark
   */
  public isDark(): boolean {
    return this.currentTheme === 'dark';
  }

  /**
   * Check if current theme is light
   */
  public isLight(): boolean {
    return this.currentTheme === 'light';
  }

  /**
   * Get theme-specific CSS variables
   */
  public getThemeColors() {
    const computedStyle = window.getComputedStyle(document.documentElement);
    
    return {
      background: computedStyle.getPropertyValue('--yt-spec-base-background'),
      text: computedStyle.getPropertyValue('--yt-spec-text-primary'),
      textSecondary: computedStyle.getPropertyValue('--yt-spec-text-secondary'),
      border: computedStyle.getPropertyValue('--yt-spec-10-percent-layer'),
      brandColor: computedStyle.getPropertyValue('--yt-spec-brand-foreground'),
      menuBackground: computedStyle.getPropertyValue('--yt-spec-menu-background'),
      raisedBackground: computedStyle.getPropertyValue('--yt-spec-raised-background'),
      buttonBackground: computedStyle.getPropertyValue('--yt-spec-button-chip-background-hover')
    };
  }

  /**
   * Get CSS class for current theme
   */
  public getThemeClass(): string {
    return this.currentTheme === 'dark' ? 'dark' : 'light';
  }

  /**
   * Force a theme detection and callback notification
   */
  public refresh(): void {
    this.detectAndNotify();
  }
}