import { auth, getAppCheckHeaderToken } from "../lib/firebase";

export async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let user = auth.currentUser;

  // If user is null, wait up to 3s for auth state to resolve (anonymous login initializes on load)
  if (!user) {
    await new Promise<void>((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((u) => {
        user = u;
        unsubscribe();
        resolve();
      });
      setTimeout(() => {
        unsubscribe();
        resolve();
      }, 3000);
    });
  }

  if (!user) {
    throw new Error("Authentication required. Please wait for session initialization.");
  }

  let token = await user.getIdToken();
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Authorization", `Bearer ${token}`);

  const appCheckToken = await getAppCheckHeaderToken();
  if (appCheckToken) {
    headers.set("X-Firebase-AppCheck", appCheckToken);
  }

  let res = await fetch(url, { ...init, headers });

  // 401 Session Expired or 403 App Check Expired -> force token refresh and retry once
  if ((res.status === 401 || res.status === 403) && auth.currentUser) {
    try {
      token = await auth.currentUser.getIdToken(true);
      headers.set("Authorization", `Bearer ${token}`);

      const freshAppCheckToken = await getAppCheckHeaderToken(true);
      if (freshAppCheckToken) {
        headers.set("X-Firebase-AppCheck", freshAppCheckToken);
      }

      res = await fetch(url, { ...init, headers });
    } catch (_retryErr) {
      // Retry failed
    }
  }

  return res;
}
