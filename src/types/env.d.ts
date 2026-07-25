// Expo statically inlines `process.env.EXPO_PUBLIC_*` at build time. Declare the
// ones we read so TypeScript is happy without pulling in all of @types/node.
declare const process: {
  env: {
    EXPO_PUBLIC_DATA_HOST?: string;
    EXPO_PUBLIC_APP_KEY?: string;
    EXPO_PUBLIC_GOOGLE_CLIENT_ID?: string;
  } & Record<string, string | undefined>;
};
