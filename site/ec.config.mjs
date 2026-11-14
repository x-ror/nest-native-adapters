import { defineEcConfig } from "@astrojs/starlight/expressive-code";

// Shared by Markdown and MDX pages; keeping it here (not in astro.config.mjs)
// makes both pipelines emit the same stylesheet.
export default defineEcConfig({
  // One graphite code sheet in both themes, like the plates in a standard.
  themes: ["github-dark-default"],
  useStarlightUiThemeColors: false,
  // Plain plates: no terminal or editor chrome around snippets.
  defaultProps: { frame: "code" },
  styleOverrides: {
    borderRadius: "0",
    borderWidth: "0",
    codeFontFamily: "'JetBrains Mono Variable', ui-monospace, monospace",
    codeFontSize: "0.875rem",
    codeLineHeight: "1.65",
    codeBackground: "#17191c",
    uiFontFamily: "'Barlow Semi Condensed', sans-serif",
    frames: {
      shadowColor: "transparent",
      frameBoxShadowCssValue: "none",
      editorTabBarBackground: "#17191c",
      editorActiveTabBackground: "#17191c",
      editorActiveTabIndicatorTopColor: "#e0234e",
      editorActiveTabIndicatorBottomColor: "transparent",
      terminalTitlebarBackground: "#17191c",
      terminalBackground: "#17191c",
      terminalTitlebarBorderBottomColor: "#2c2f33",
      terminalTitlebarDotsOpacity: "0",
      inlineButtonBackground: "#e8e9e6",
      inlineButtonForeground: "#e8e9e6",
      inlineButtonBorder: "#5b5f63",
      tooltipSuccessBackground: "#e0234e",
    },
  },
});
