const EMPTY_LOCAL_CONFIG = Object.freeze({
  RAWG_API_KEY: "",
  YOUTUBE_API_KEY: "",
  MYMEMORY_EMAIL: ""
});

let localConfigPromise;

export async function getLocalConfig() {
  if (!localConfigPromise) {
    localConfigPromise = import("../config.local.js")
      .then((module) => ({
        RAWG_API_KEY: module?.LOCAL_CONFIG?.RAWG_API_KEY || "",
        YOUTUBE_API_KEY: module?.LOCAL_CONFIG?.YOUTUBE_API_KEY || "",
        // Opcional: e-mail para aumentar o limite diário do tradutor gratuito MyMemory.
        MYMEMORY_EMAIL: module?.LOCAL_CONFIG?.MYMEMORY_EMAIL || ""
      }))
      .catch(() => EMPTY_LOCAL_CONFIG);
  }

  return localConfigPromise;
}
