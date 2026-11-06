// Comunicação com o script da Google (Apps Script).
// O pedido vai como texto simples para a Google não exigir verificações extra do navegador (CORS).
window.futuraApi = (function () {
  'use strict';

  async function chamar(acao, dados) {
    var url = window.FUTURA_CONFIG && window.FUTURA_CONFIG.API_URL;
    if (!url || url.indexOf('COLOCAR_AQUI') > -1) {
      throw new Error('API_URL não configurado');
    }
    var corpo = JSON.stringify(Object.assign({ acao: acao }, dados || {}));
    var controlo = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var relogio = controlo ? setTimeout(function () { controlo.abort(); }, 50000) : null;
    try {
      var resposta = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: corpo,
        signal: controlo ? controlo.signal : undefined
      });
      if (!resposta.ok) throw new Error('Resposta ' + resposta.status);
      return await resposta.json();
    } finally {
      if (relogio) clearTimeout(relogio);
    }
  }

  return {
    pedirAcesso: function (email, idioma) { return chamar('pedir_acesso', { email: email, idioma: idioma }); },
    carregar: function (token) { return chamar('carregar', { token: token }); },
    guardar: function (token, dados) { return chamar('guardar', Object.assign({ token: token }, dados)); },
    cancelar: function (token) { return chamar('cancelar', { token: token }); },
    boPedirAcesso: function (email) { return chamar('bo_pedir_acesso', { email: email }); },
    boCarregar: function (token) { return chamar('bo_carregar', { token: token }); },
    boListas: function (token) { return chamar('bo_listas', { token: token }); },
    boAcao: function (token, tipo, dados) { return chamar('bo_acao', Object.assign({ token: token, tipo: tipo }, dados || {})); }
  };
})();
