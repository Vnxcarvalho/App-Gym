// lib/alert.ts
//
// react-native-web não implementa Alert (é um no-op silencioso no navegador),
// e window.confirm/alert funcionam mas são feios e bloqueiam a thread da
// página. Esse módulo tem a MESMA assinatura de `Alert.alert` do react-native
// — os call-sites não mudam — só que em vez de chamar a API nativa, guarda o
// estado do alerta e notifica quem estiver ouvindo (o <AlertHost /> montado
// na raiz do app), que renderiza um modal próprio, no estilo do app.
export type AlertButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

export type AlertState = { title: string; message?: string; buttons: AlertButton[] };

let currentState: AlertState | null = null;
let listeners: Array<(state: AlertState | null) => void> = [];

function notify() {
  listeners.forEach((listener) => listener(currentState));
}

function alertImpl(title: string, message?: string, buttons?: AlertButton[]) {
  currentState = {
    title,
    message,
    buttons: buttons && buttons.length > 0 ? buttons : [{ text: "OK" }],
  };
  notify();
}

export const Alert = { alert: alertImpl };

export function subscribeAlert(listener: (state: AlertState | null) => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function dismissAlert() {
  currentState = null;
  notify();
}
