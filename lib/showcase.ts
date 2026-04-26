// PUBLIC_SHOWCASE mode flag.
//
// When set to "1" at build time, the app turns into a fully client-side,
// bring-your-own-key demo:
//   - /admin and /api/admin/* are disabled (return 410 Gone)
//   - /api/generate and /api/generate/[id]/* are disabled (return 410 Gone)
//   - /api/status returns public defaults only and never reads data/settings.json
//   - the home page captures an OpenAI-compatible API key in localStorage and
//     calls the provider directly from the browser (the key never touches the
//     server hosting this app)
//
// We use `NEXT_PUBLIC_*` so the value is inlined at build time and the same
// constant is readable from both server route handlers and browser code.
export const IS_SHOWCASE = process.env.NEXT_PUBLIC_SHOWCASE === "1";
