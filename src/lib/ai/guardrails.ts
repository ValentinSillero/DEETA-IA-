const mutationRequest = /\b(?:cambi(?:á|a|ame|ale)|modific(?:á|a|ame|ale)|sub(?:í|i|ime|ile)|baj(?:á|a|ame|ale)|elimin(?:á|a|ame|ale)|borr(?:á|a|ame|ale)|cre(?:á|a|ame|ale)|registr(?:á|a|ame|ale)|cerr(?:á|a|ame|ale)|cancel(?:á|a|ame|ale)|perdon(?:á|a|ale)|condon(?:á|a|ale)|anul(?:á|a|ale)|ajust(?:á|a|ale)|carg(?:á|a|ale)|descont(?:á|a|ale))(?=\s|[.,;:!?]|$)[\s\S]{0,100}\b(?:precio|stock|venta|gasto|caja|producto|usuario|pago|deuda|cliente|fiado|ajuste|saldo)s?\b/i;
const secretOrSqlRequest = /\b(?:database_url|groq_api_key|better_auth_secret|api[ _-]?key|contraseña|credencial(?:es)?|ejecut(?:á|a|ame|ar)?\s+(?:una?\s+)?(?:consulta\s+)?sql|select\s+\*?\s*from|insert\s+into|update\s+\w+\s+set|delete\s+from|drop\s+table)\b/i;
const crossBusinessRequest = /\b(?:(?:otro|otros|todos|todas)\s+(?:los\s+|las\s+)?(?:negocio|comercio|empresa)s?|informaci[oó]n\s+de\s+(?:otro|otros|todos|todas))\b/i;
const promptInjectionRequest = /\b(?:ignor(?:á|a|ar|e)\s+(?:todas?\s+)?(?:tus?|las?)\s+instrucciones|revel(?:á|a|ame|ar)\s+(?:tus?|las?)\s+instrucciones|system\s+prompt)\b/i;

export function restrictedRequestReply(question: string) {
  if (mutationRequest.test(question)) {
    return "Por ahora puedo ayudarte a analizar el negocio, pero no modificar datos.";
  }
  if (secretOrSqlRequest.test(question) || promptInjectionRequest.test(question)) {
    return "No puedo acceder a secretos, ejecutar SQL ni ignorar las reglas de seguridad de DEETA. Sí puedo ayudarte a analizar los datos autorizados de tu negocio.";
  }
  if (crossBusinessRequest.test(question)) {
    return "Solo puedo analizar la información del negocio al que pertenecés y para el que tenés permiso.";
  }
  return null;
}
