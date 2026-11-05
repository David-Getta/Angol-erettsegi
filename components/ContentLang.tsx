"use client";

import { createContext, useContext } from "react";

/**
 * Language of the study material of the current subject ("en", "de", "hu"):
 * set once in the root layout, used for `lang` attributes (spell checking,
 * hyphenation, screen readers) in client components.
 */
const ContentLangContext = createContext("en");

export function ContentLangProvider({ lang, children }: { lang: string; children: React.ReactNode }) {
  return <ContentLangContext.Provider value={lang}>{children}</ContentLangContext.Provider>;
}

export function useContentLang(): string {
  return useContext(ContentLangContext);
}
