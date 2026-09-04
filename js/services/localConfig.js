const EMPTY_LOCAL_CONFIG = Object.freeze({
  RAWG_API_KEY: "",
  YOUTUBE_API_KEY: ""
});

let localConfigPromise;

export async function getLocalConfig() {
  if (!localConfigPromise) {
    localConfigPromise = import("../config.local.js")
      .then((module) => ({
        RAWG_API_KEY: module?.LOCAL_CONFIG?.RAWG_API_KEY || "",
        YOUTUBE_API_KEY: module?.LOCAL_CONFIG?.YOUTUBE_API_KEY || ""
      }))
      .catch(() => EMPTY_LOCAL_CONFIG);
  }

  return localConfigPromise;
}
