/// <reference types="vite/client" />

// Allow importing CSS as a raw string using Vite's ?inline query
declare module '*.css?inline' {
  const content: string;
  export default content;
}
