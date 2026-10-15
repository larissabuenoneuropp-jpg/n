// Navegação por "#/caminho?parametros" — funciona abrindo o arquivo HTML direto do computador.
import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const getHash = () => window.location.hash.slice(1) || "/financeiro";

export function useLocationHash() {
  return useSyncExternalStore(subscribe, getHash, () => "/financeiro");
}

export function usePathname() {
  return useLocationHash().split("?")[0];
}

export function useSearchParams() {
  const h = useLocationHash();
  const i = h.indexOf("?");
  return new URLSearchParams(i >= 0 ? h.slice(i + 1) : "");
}

export function useRouter() {
  return {
    push: (href: string) => { window.location.hash = href; },
    replace: (href: string) => { window.location.replace(`#${href}`); },
    back: () => window.history.back(),
  };
}
