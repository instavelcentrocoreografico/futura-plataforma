// Página pública da futura (esqueleto): pedir link de acesso e ver a programação.
(function () {
  'use strict';

  var TEXTOS = window.FUTURA_TEXTOS;
  var raiz = document.getElementById('conteudo');
  var lang = 'pt';
  var token = null;
  var dados = null; // resposta de "carregar"

  function t(chave, vars) {
    var texto = TEXTOS[lang][chave];
    if (texto === undefined) return chave;
    if (typeof texto !== 'string') return texto;
    return texto.replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] !== undefined ? vars[k] : m; });
  }

  // Criar elementos sempre com textContent: o texto vindo da folha nunca é interpretado como HTML.
  function el(tag, atributos, filhos) {
    var e = document.createElement(tag);
    Object.keys(atributos || {}).forEach(function (k) {
      if (k === 'texto') e.textContent = atributos[k];
      else if (k === 'classe') e.className = atributos[k];
      else e.setAttribute(k, atributos[k]);
    });
    (filhos || []).forEach(function (f) { if (f) e.appendChild(f); });
    return e;
  }

  function urlSegura(u) { return /^https?:\/\//i.test(String(u || '').trim()); }

  function formatarDataHora(iso) {
    if (!iso) return '';
    return new Intl.DateTimeFormat(lang === 'pt' ? 'pt-PT' : 'en-GB', {
      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon'
    }).format(new Date(iso));
  }

  function formatarDia(dia) {
    return new Intl.DateTimeFormat(lang === 'pt' ? 'pt-PT' : 'en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC'
    }).format(new Date(dia + 'T12:00:00Z'));
  }

  /* ---------- início ---------- */

  function iniciar() {
    var params = new URLSearchParams(window.location.search);
    var guardado = null;
    try { guardado = window.localStorage.getItem('futura_lang'); } catch (e) { /* sem armazenamento */ }
    var pedido = params.get('l');
    lang = (pedido === 'pt' || pedido === 'en') ? pedido
      : (guardado === 'pt' || guardado === 'en') ? guardado
      : (String(navigator.language || '').toLowerCase().indexOf('pt') === 0 ? 'pt' : 'en');

    // O token vem no link do email. Guarda-se só nesta sessão e tira-se do endereço.
    var tokenUrl = params.get('t');
    if (tokenUrl) {
      try { window.sessionStorage.setItem('futura_token', tokenUrl); } catch (e) { /* sem armazenamento */ }
      window.history.replaceState(null, '', window.location.pathname);
    }
    try { token = window.sessionStorage.getItem('futura_token'); } catch (e) { token = tokenUrl; }
    if (!token) token = tokenUrl;

    document.getElementById('botao-idioma').addEventListener('click', function () {
      lang = lang === 'pt' ? 'en' : 'pt';
      try { window.localStorage.setItem('futura_lang', lang); } catch (e) { /* sem armazenamento */ }
      desenhar();
    });

    if (token) carregar(); else { dados = null; desenhar(); }
  }

  async function carregar() {
    try {
      var r = await window.futuraApi.carregar(token);
      if (r && r.ok) {
        dados = r;
        desenhar();
      } else {
        token = null;
        try { window.sessionStorage.removeItem('futura_token'); } catch (e) { /* sem armazenamento */ }
        dados = null;
        desenhar(t('linkInvalido'));
      }
    } catch (e) {
      dados = null;
      desenhar(e && /API_URL/.test(e.message) ? t('erroConfig') : t('erroGeral'));
    }
  }

  /* ---------- desenhar ---------- */

  function desenhar(mensagemErro) {
    document.documentElement.lang = lang;
    document.title = t('titulo');
    document.getElementById('botao-idioma').textContent = t('idiomaBotao');
    document.getElementById('rodape-texto').textContent = t('rodape');
    raiz.textContent = '';
    if (dados) desenharPerfil(); else desenharPedido(mensagemErro);
  }

  function desenharPedido(mensagemErro) {
    raiz.appendChild(el('h1', { texto: t('introTitulo') }));
    raiz.appendChild(el('p', { texto: t('intro') }));
    if (mensagemErro) raiz.appendChild(el('p', { classe: 'erro', role: 'alert', texto: mensagemErro }));
    raiz.appendChild(el('p', { texto: t('introAcesso') }));

    var campo = el('input', { type: 'email', id: 'campo-email', name: 'email', autocomplete: 'email', required: 'required', inputmode: 'email' });
    var botao = el('button', { type: 'submit', classe: 'botao', texto: t('pedirBotao') });
    var estado = el('p', { id: 'estado-pedido', role: 'status', 'aria-live': 'polite' });
    var form = el('form', { novalidate: 'novalidate' }, [
      el('label', { 'for': 'campo-email', texto: t('emailEtiqueta') }), campo, botao, estado
    ]);

    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      estado.className = '';
      estado.textContent = '';
      var email = campo.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        estado.className = 'erro';
        estado.textContent = t('erroEmail');
        campo.focus();
        return;
      }
      botao.disabled = true;
      botao.textContent = t('aEnviar');
      try {
        var r = await window.futuraApi.pedirAcesso(email, lang);
        if (r && r.ok) {
          raiz.textContent = '';
          raiz.appendChild(el('h1', { texto: t('enviadoTitulo') }));
          raiz.appendChild(el('p', { texto: t('enviado') }));
          raiz.focus();
          return;
        }
        estado.className = 'erro';
        estado.textContent = r && r.erro === 'email_invalido' ? t('erroEmail')
          : r && r.erro === 'indisponivel' ? t('erroIndisponivel') : t('erroGeral');
      } catch (e) {
        estado.className = 'erro';
        estado.textContent = e && /API_URL/.test(e.message) ? t('erroConfig') : t('erroGeral');
      }
      botao.disabled = false;
      botao.textContent = t('pedirBotao');
    });
    raiz.appendChild(form);
  }

  function desenharPerfil() {
    var p = dados.pessoa;
    raiz.appendChild(el('h1', { texto: p.nome ? t('saudacao', { nome: p.nome }) : t('saudacaoSemNome') }));
    raiz.appendChild(el('p', { classe: 'suave', texto: t('nivel')[p.nivel] || '' }));

    var j = dados.janela;
    var aviso = j.estado === 'aberta' ? t('janelaAberta', { fecho: formatarDataHora(j.fecha_em) })
      : j.estado === 'por_abrir' ? t('janelaPorAbrir', { abre: formatarDataHora(j.abre_em) })
      : t('janelaFechada');
    raiz.appendChild(el('div', { classe: 'cartao aviso' }, [el('p', { texto: aviso })]));

    raiz.appendChild(el('h2', { texto: t('programa') }));
    desenharPrograma(dados.programa.sessoes);
    desenharRefeicoes(dados.programa.refeicoes);
  }

  function desenharPrograma(sessoes) {
    var porDia = {};
    sessoes.forEach(function (s) { (porDia[s.dia] = porDia[s.dia] || []).push(s); });
    Object.keys(porDia).sort().forEach(function (dia) {
      raiz.appendChild(el('h3', { classe: 'dia', texto: formatarDia(dia) }));
      porDia[dia].forEach(function (s) { raiz.appendChild(desenharSessao(s)); });
    });
  }

  function textoSinopse(peca) {
    var principal = lang === 'pt' ? peca.sinopse_pt : peca.sinopse_en;
    var outra = lang === 'pt' ? peca.sinopse_en : peca.sinopse_pt;
    return String(principal || outra || '').trim();
  }

  function desenharSessao(s) {
    var hora = s.fim ? s.inicio + ' – ' + s.fim : s.inicio;
    var info = [];
    if (s.sala) info.push(s.sala);

    var etiquetas = [];
    if (s.tipo === 'bloco') etiquetas.push(el('span', { classe: 'etiqueta', texto: t('bloco') }));
    if (s.inscricao === 'por_definir') etiquetas.push(el('span', { classe: 'etiqueta', texto: t('inscricaoPorDefinir') }));
    else if (s.inscricao !== 'sim') etiquetas.push(el('span', { classe: 'etiqueta', texto: t('semInscricao') }));
    else if (s.lugares_livres !== null) {
      etiquetas.push(el('span', { classe: 'etiqueta', texto: s.lugares_livres > 0 ? t('lugaresLivres', { n: s.lugares_livres }) : t('semLugares') }));
    }

    var cartao = el('article', { classe: 'sessao' }, [
      el('div', { classe: 'sessao-cabeca' }, [
        el('span', { classe: 'sessao-hora', texto: hora }),
        el('span', { classe: 'sessao-titulo', texto: s.titulo })
      ]),
      el('p', { classe: 'sessao-info' }, etiquetas.concat([el('span', { texto: info.join(' · ') })]))
    ]);

    var pecasComConteudo = s.pecas.filter(function (x) { return textoSinopse(x) || urlSegura(x.url) || x.artistas; });
    if (pecasComConteudo.length) {
      var detalhes = el('details', {}, [el('summary', { texto: t('verMais') })]);
      pecasComConteudo.forEach(function (x) {
        var sinopse = textoSinopse(x);
        var bloco = el('div', { classe: 'peca' }, [
          el('h4', { texto: x.titulo }),
          x.artistas ? el('p', { classe: 'peca-artistas', texto: x.artistas }) : null,
          x.estado === 'por_confirmar' ? el('p', {}, [el('span', { classe: 'etiqueta', texto: t('porConfirmar') })]) : null,
          sinopse ? el('p', { texto: sinopse }) : null,
          urlSegura(x.url) ? el('p', {}, [el('a', { href: x.url.trim(), target: '_blank', rel: 'noopener noreferrer', texto: t('paginaPeca') })]) : null
        ]);
        detalhes.appendChild(bloco);
      });
      cartao.appendChild(detalhes);
    }
    return cartao;
  }

  function desenharRefeicoes(refeicoes) {
    if (!refeicoes || !refeicoes.length) return;
    raiz.appendChild(el('h2', { texto: t('refeicoes') }));
    refeicoes.forEach(function (r) {
      var hora = r.fim ? r.inicio + ' – ' + r.fim : r.inicio;
      var linha = [formatarDia(r.dia), hora, r.local].filter(String).join(' · ');
      var partes = [
        el('div', { classe: 'sessao-cabeca' }, [
          el('span', { classe: 'sessao-titulo', texto: r.tipo === 'jantar' ? t('jantar') : t('almoco') })
        ]),
        el('p', { classe: 'sessao-info', texto: linha })
      ];
      if (!r.acesso) partes.push(el('p', { classe: 'sessao-info' }, [el('span', { classe: 'etiqueta', texto: t('semAcessoRefeicao') })]));
      else if (r.custo_pessoa) partes.push(el('p', { classe: 'sessao-info', texto: t('custo', { valor: r.custo_pessoa }) }));
      raiz.appendChild(el('article', { classe: 'sessao' }, partes));
    });
  }

  iniciar();
})();
