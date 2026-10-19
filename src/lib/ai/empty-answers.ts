// Respuestas fijas de DEETA AI cuando no hay datos. En lugar de un párrafo,
// el chat las muestra como un estado breve con el próximo paso.
// Solo cambia la presentación: el texto guardado de la conversación es el mismo.

export type AiEmptyAnswerAction = "SELL" | "ADD_PRODUCT" | "PRODUCTS";

export type AiEmptyAnswer = {
  title: string;
  text: string;
  tone: "empty" | "ok";
  action?: AiEmptyAnswerAction;
};

const EMPTY_ANSWERS: Record<string, AiEmptyAnswer> = {
  "Todavía no hay ventas registradas en este período para identificar un producto más vendido.": {
    title: "Sin ventas todavía",
    text: "Cuando registres ventas, te muestro qué producto vendés más.",
    tone: "empty",
    action: "SELL",
  },
  "Todavía no hay productos cargados para analizar el inventario.": {
    title: "Sin productos cargados",
    text: "Cargá productos para que pueda revisar tu stock.",
    tone: "empty",
    action: "ADD_PRODUCT",
  },
  "Todavía no hay productos cargados para analizar sus ventas.": {
    title: "Sin productos cargados",
    text: "Cargá productos y registrá ventas para ver cuáles se venden más.",
    tone: "empty",
    action: "ADD_PRODUCT",
  },
  "No hay ventas registradas en este período para responder esa consulta.": {
    title: "Sin ventas en este período",
    text: "Probá con otro período o registrá una venta.",
    tone: "empty",
    action: "SELL",
  },
  "No encontré productos que necesiten reposición con la información disponible.": {
    title: "Nada para reponer",
    text: "Con lo que vendiste, ningún producto necesita reposición ahora.",
    tone: "ok",
    action: "PRODUCTS",
  },
  "No encontré productos con baja rotación en el período analizado.": {
    title: "Sin productos quietos",
    text: "Todos tus productos se vendieron en el período.",
    tone: "ok",
  },
  "No encontré productos con exceso de stock según su ritmo reciente.": {
    title: "Sin exceso de stock",
    text: "Ningún producto tiene más stock del que vendés.",
    tone: "ok",
  },
  "No encontré productos que coincidan con ese estado de stock.": {
    title: "Sin productos en ese estado",
    text: "Ningún producto coincide con lo que buscaste.",
    tone: "ok",
    action: "PRODUCTS",
  },
};

export function aiEmptyAnswer(content: string) {
  return EMPTY_ANSWERS[content.trim()] ?? null;
}
