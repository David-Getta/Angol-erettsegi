import type { MetadataRoute } from "next";

/** Lets the app be added to a phone's home screen when it is opened over the local network (npm run dev:lan). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Angol érettségi felkészítő",
    short_name: "Angol érettségi",
    description: "Lokális felkészítő app az angol érettségire (közép és emelt szint).",
    lang: "hu",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f5f1",
    theme_color: "#2f6f6a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
