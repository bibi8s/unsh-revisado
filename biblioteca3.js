(function () {
  'use strict';

  var DB = 'https://unsheltered-72d40-default-rtdb.firebaseio.com';
  var FUSO_MS = -3 * 3600000;  
  var TRAVA_VALIDADE_MS = 120000;

 

  var PADRAO = {
    geral: { abre: 6, fecha: 23, limite_diario_h: 6, opcoes_horas: [1, 2, 3, 4, 5, 6], atualizacao_s: 30, status_max: 150 },
    atributos: { base: 25, int_pct: 20, int_aplicar: false, det_energia: 2, sab_pct: 15, sab_aplicar: false },
    interacoes: {
      cutucar:     { nome: 'Cutucar',           bonus_pct: 2,  hp: 0,  limite_dia: 2, ordem: 1 },
      impulsionar: { nome: 'Impulsionar',       bonus_pct: 4,  hp: 0,  limite_dia: 2, ordem: 2 },
      atrapalhar:  { nome: 'Atrapalhar',        bonus_pct: -4, hp: 0,  limite_dia: 2, ordem: 3 },
      livro:       { nome: 'Atingir com livro', bonus_pct: 0,  hp: -5, limite_dia: 2, ordem: 4 }
    },
    bilhetes: { por_dia: 5, energia_por_dia: 3, energia: 5, caixa_max: 20, max_caracteres: 300 },
    dupla: { bonus_pct: 5 },
    livros: { dias: 10, maestrias_mes: 2 },
    inferior: { resistencia: 10, sabedoria: 5 },
    mesas: {
      central:  { nome: 'Mesa Central',           descricao: 'Sem bônus',                 cor: '#9e9e9e', limite: 0, vagas_dia: 0, bonus_pct: 0,  energia_h: 5, imune_atrapalhar: false, atrapalhar_livre: false, exclusiva_dia: false, ordem: 1 },
      corredor: { nome: 'Mesa do Corredor',       descricao: '+5% horas estudadas',       cor: '#e07b39', limite: 5, vagas_dia: 0, bonus_pct: 5,  energia_h: 5, imune_atrapalhar: false, atrapalhar_livre: false, exclusiva_dia: false, ordem: 2 },
      fundo:    { nome: 'Mesa do Fundo',          descricao: 'Imune a atrapalhar',        cor: '#4a7fa5', limite: 3, vagas_dia: 0, bonus_pct: 0,  energia_h: 5, imune_atrapalhar: true,  atrapalhar_livre: false, exclusiva_dia: false, ordem: 3 },
      janela:   { nome: 'Mesa perto da Janela',   descricao: '-1 energia/hora',           cor: '#c9a84c', limite: 3, vagas_dia: 0, bonus_pct: 0,  energia_h: 4, imune_atrapalhar: false, atrapalhar_livre: false, exclusiva_dia: false, ordem: 4 },
      banheiro: { nome: 'Mesa perto do Banheiro', descricao: '-4% horas · atrapalhar livre', cor: '#5a8f6a', limite: 0, vagas_dia: 2, bonus_pct: -4, energia_h: 5, imune_atrapalhar: false, atrapalhar_livre: true,  exclusiva_dia: true,  ordem: 5 }
    },
    marcos: {
      m12:  { horas: 12,  pontos: 5,  itens: {} },
      m24:  { horas: 24,  pontos: 5,  itens: {} },
      m42:  { horas: 42,  pontos: 5,  itens: {} },
      m70:  { horas: 70,  pontos: 10, itens: {} },
      m80:  { horas: 80,  pontos: 10, itens: {} },
      m100: { horas: 100, pontos: 15, itens: { a: { nome: '✦ Atributo Resgatável', descricao: '+1 em INT, SAB ou DET.', categoria: 'Off-Game' } } }
    }
  };
  var MESA_MODELO = PADRAO.mesas.central;
  var POSICOES_INFERIOR = [
    { top: '42%', left: '7%' }, { top: '84%', left: '35%' }, { top: '15%', left: '44%' }, { top: '55%', left: '73%' },
    { top: '42%', left: '12%' }, { top: '71%', left: '14%' }, { top: '69%', left: '57%' }, { top: '50%', left: '1%' },
    { top: '65%', left: '27%' }, { top: '55%', left: '20%' }
  ];
  var NOMES_CASAS = { grifinoria: 'Grifinória', lufalufa: 'Lufa-Lufa', corvinal: 'Corvinal', sonserina: 'Sonserina' };
 

  var S = {
    raiz: null, user: null, eu: null, cfg: null, offset: 0,
    ativas: {}, minha: null, envios: {}, hojeReais: 0, diaAtual: null,
    atributos: {}, progresso: null, naolidos: {}, nomes: null,
    andar: 1, fechando: {}, timerCrono: null, timerAtualizar: null, atualizando: false, relogioOk: false
  };
 

  function fk(uid) { return 'u' + String(uid).replace(/^u/i, ''); }
  function agora() { return Math.round(Date.now() + S.offset); }
  function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function arred(n) { return Math.round(n * 10000) / 10000; }
  function num(v, padrao) { var n = Number(v); return Number.isFinite(n) ? n : padrao; }

  function partes(ms) {
    var d = new Date(ms + FUSO_MS);
    return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate(), hora: d.getUTCHours() };
  }
  function p2(n) { return String(n).padStart(2, '0'); }
  function diaKey(ms) { var p = partes(ms); return p.ano + '-' + p2(p.mes) + '-' + p2(p.dia); }
  function mesKey(ms) { var p = partes(ms); return p.ano + '-' + p2(p.mes); }
  function fmtData(ms) { var p = partes(ms); return p2(p.dia) + '/' + p2(p.mes) + '/' + p.ano; }
  function fmtHoras(h) {
    h = Math.max(0, h || 0);
    var hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    if (mm === 60) { hh++; mm = 0; }
    return mm > 0 ? hh + 'h' + p2(mm) : hh + 'h';
  }
  function fmtRelogio(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(s / 3600) + ':' + p2(Math.floor((s % 3600) / 60)) + ':' + p2(s % 60);
  }

   function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
   function rico(v) {
    return esc(v).replace(/&lt;(\/?)(b|strong|i|em)&gt;/gi, '<$1$2>');
  }
   function chaveSegura(s) {
    return String(s).replace(/[.#$\[\]\/%]/g, function (c) { return '%' + c.charCodeAt(0).toString(16).toUpperCase(); });
  }
  function caminho() {
    return Array.prototype.slice.call(arguments).map(function (p) {
      return String(p).split('/').map(encodeURIComponent).join('/');
    }).join('/');
  }


  function req(cam, metodo, corpo, consulta) {
    var ctrl = new AbortController();
    var limite = setTimeout(function () { ctrl.abort(); }, 15000);
    var opcoes = { method: metodo || 'GET', signal: ctrl.signal };
    if (corpo !== undefined) {
      opcoes.headers = { 'Content-Type': 'application/json' };
      opcoes.body = JSON.stringify(corpo);
    }
    var url = DB + '/' + cam + '.json' + (consulta ? '?' + consulta : '');
    return fetch(url, opcoes)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(function (e) { if (e.name === 'AbortError') throw new Error('o servidor não respondeu'); throw e; })
      .finally(function () { clearTimeout(limite); });
  }

  function gravarVarios(m) { return req('', 'PATCH', m); }
  function soma(n) { return { '.sv': { increment: n } }; }
  var TS = { '.sv': 'timestamp' };

  var gerarId = (function () {
    var C = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
    var ultimo = 0, aleat = [];
    return function () {
      var t = Date.now(), rep = t === ultimo, i;
      ultimo = t;
      var tempo = new Array(8);
      for (i = 7; i >= 0; i--) { tempo[i] = C.charAt(t % 64); t = Math.floor(t / 64); }
      var id = tempo.join('');
      if (!rep) { for (i = 0; i < 12; i++) aleat[i] = Math.floor(Math.random() * 64); }
      else { for (i = 11; i >= 0 && aleat[i] === 63; i--) aleat[i] = 0; aleat[i]++; }
      for (i = 0; i < 12; i++) id += C.charAt(aleat[i]);
      return id;
    };
  })();

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function mesclar(padrao, salvo) {
    if (salvo === undefined || salvo === null) return clone(padrao);
    if (typeof padrao !== 'object' || padrao === null || Array.isArray(padrao)) return salvo;
    var r = {};
    Object.keys(padrao).forEach(function (k) { r[k] = mesclar(padrao[k], salvo[k]); });
    Object.keys(salvo).forEach(function (k) { if (!(k in r)) r[k] = salvo[k]; });
    return r;
  }
  function ordenar(obj) {
    return Object.keys(obj || {}).filter(function (k) { return obj[k]; })
      .sort(function (a, b) { return (num(obj[a].ordem, 99) - num(obj[b].ordem, 99)) || a.localeCompare(b); });
  }




  async function travar(nome) {
    var cam = caminho('biblioteca/travas', nome);
    var atual = await req(cam);
    if (atual && (atual.feito || agora() - num(atual.em, 0) < TRAVA_VALIDADE_MS)) return null;
    var token = gerarId();
    await req(cam, 'PUT', { token: token, em: agora(), uid: S.eu });
    await esperar(1500);
    var depois = await req(cam);
    if (!depois || depois.token !== token || depois.feito) return null;
    return { cam: 'biblioteca/travas/' + nome };
  }
  function travaFeita(m, trava) { m[trava.cam] = { feito: true, em: TS }; }



  async function carregarConfig() {
    var salvo = null;
    try { salvo = await req('biblioteca/configuracao'); } catch (e) {}
    salvo = salvo || {};
    var cfg = {};
    ['geral', 'atributos', 'bilhetes', 'dupla', 'livros', 'inferior'].forEach(function (k) { cfg[k] = mesclar(PADRAO[k], salvo[k]); });
    cfg.interacoes = mesclar(PADRAO.interacoes, salvo.interacoes);
    var mesas = salvo.mesas || PADRAO.mesas;
    cfg.mesas = {};
    Object.keys(mesas).forEach(function (id) { if (mesas[id]) cfg.mesas[id] = mesclar(MESA_MODELO, mesas[id]); });
    cfg.marcos = clone(salvo.marcos || PADRAO.marcos);
    if (!Array.isArray(cfg.geral.opcoes_horas)) cfg.geral.opcoes_horas = Object.values(cfg.geral.opcoes_horas || {});
    S.cfg = cfg;
  }

  async function horaServidor() {
    var cam = caminho('biblioteca/relogio', S.eu);
    var t0 = Date.now();
    await req(cam, 'PUT', TS);
    var ts = await req(cam);
    var t1 = Date.now();
    if (typeof ts !== 'number') throw new Error('não foi possível obter a hora do servidor');
    S.offset = Math.round(ts - (t0 + t1) / 2);
    S.relogioOk = true;
    return Math.round(ts + (t1 - t0) / 2);
  }
  async function sincronizarRelogio() {
    try { await horaServidor(); } catch (e) { S.relogioOk = false; }
  }

  function mesa(id) { return S.cfg.mesas[id] || null; }
  function nomeDe(uid) {
    var k = fk(uid);
    if (S.ativas[k] && S.ativas[k].nome) return S.ativas[k].nome;
    if (S.nomes && S.nomes[k] && S.nomes[k].nome) return S.nomes[k].nome;
    return k;
  }
  async function carregarNomes() {
    if (!S.nomes) { try { S.nomes = (await req('saldos')) || {}; } catch (e) { S.nomes = {}; } }
    return S.nomes;
  }

  
  
  function multiplicador(s) {
    var mesaM = 1 + num(s.mesa_bonus_pct, 0) / 100;
    var intM = 1 + num(s.int_pct, 0) / 100;
    var sabM = 1 + num(s.sab_pct, 0) / 100;
    var extras = num(s.bonus_dupla_pct, 0) + num(s.bonus_pos, 0) * sabM + num(s.bonus_neg, 0);
    return mesaM * intM * (1 + extras / 100);
  }
  function bonusAtualPct(s) { return Math.round((multiplicador(s) - 1) * 100); }

  function bonusAtributos(at) {
    var a = S.cfg.atributos, base = num(a.base, 25) || 25;
    return {
      int: Math.round(num(at.inteligencia, 0) / base * num(a.int_pct, 0)),
      det: Math.floor(num(at.determinacao, 0) / base * num(a.det_energia, 0)),
      sab: Math.round(num(at.sabedoria, 0) / base * num(a.sab_pct, 0))
    };
  }


  async function fecharSessao(s, motivo) {
    var uidk = fk(s.uid);
        var chave = uidk + '_' + Math.round(s.inicio_em);
    if (S.fechando[chave]) return false;
    S.fechando[chave] = true;
    try {
      var trava = await travar('sessao_' + chave);
      if (!trava) return false;
      var atual = await req(caminho('biblioteca/ativas', uidk));
      if (!atual || atual.inicio_em !== s.inicio_em) {
        var mm = {}; travaFeita(mm, trava); await gravarVarios(mm);
        return false;
      }
      var servidor;
      try { servidor = await horaServidor(); }
      catch (e) { await req(trava.cam, 'DELETE').catch(function () {}); delete S.fechando[chave]; return null; }
      if (motivo !== 'saida' && servidor < atual.termina_em) {
        await req(trava.cam, 'DELETE').catch(function () {});
        delete S.fechando[chave];
        return false;
      }
      var fim = motivo === 'saida' ? Math.min(servidor, atual.termina_em) : atual.termina_em;
      var reais = arred(Math.max(0, (fim - atual.inicio_em) / 3600000));
      var mult = multiplicador(atual);
      var efet = arred(reais * mult);
      var mes = mesKey(fim), dia = diaKey(atual.inicio_em);
      var m = {};
      m['biblioteca/ativas/' + uidk] = null;
      m['biblioteca/historico/' + uidk + '/s' + Math.round(atual.inicio_em)] = {
        inicio_em: atual.inicio_em, fim_em: fim, horas_reais: reais, horas_efetivas: efet,
        bonus_pct: Math.round((mult - 1) * 100), mesa_id: atual.mesa_id || null,
        mesa_label: atual.mesa_nome || null, livro: atual.livro || null, motivo: motivo, ts: TS
      };
      m['biblioteca/hoje/' + dia + '/' + uidk] = soma(reais);
      m['biblioteca/progresso/' + uidk + '/' + mes + '/horas_efetivas'] = soma(efet);
      m['biblioteca/ranking/' + mes + '/' + uidk + '/horas'] = soma(efet);
      m['biblioteca/ranking/' + mes + '/' + uidk + '/nome'] = atual.nome || uidk;
      if (atual.livro) {
        var lk = chaveSegura(atual.livro);
        m['biblioteca/livros-dias/' + uidk + '/' + dia.slice(0, 7) + '/' + lk + '/nome'] = atual.livro;
        m['biblioteca/livros-dias/' + uidk + '/' + dia.slice(0, 7) + '/' + lk + '/dias/' + dia] = true;
      }
      travaFeita(m, trava);
      await gravarVarios(m);
      return true;
    } catch (e) {
      console.error('[Biblioteca] Falha ao fechar sessão:', e);
            delete S.fechando[chave];
      if (uidk === S.eu) toast('Falha ao encerrar a sessão: ' + e.message, true);
      return null;
    }
  }

 

  var ICONES = {
    bilhetes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18v12H3z"/><path d="M3 7l9 6 9-6"/></svg>',
    interacoes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/></svg>',
    mais: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
  };

  function montarEstrutura() {
    var r = S.raiz;
    r.classList.add('bb');
    r.innerHTML =
      '<header class="bbtopo">' +
        '<div class="bbtoponome">' + esc(S.user.nome) + '</div>' +
        '<nav class="bbandares" aria-label="Andares">' +
          '<button type="button" class="bbandar bbandar1" data-acao="andar" data-andar="1">Biblioteca</button>' +
          '<button type="button" class="bbandar bbandar2" data-acao="andar" data-andar="2">Sessão restrita</button>' +
          '<button type="button" class="bbandar bbandar3" data-acao="andar" data-andar="3">Andar inferior</button>' +
        '</nav>' +
        '<div class="bbtopodir">' +
          '<nav class="bbferramentas" aria-label="Ferramentas">' +
            '<button type="button" class="bbferramenta bbfbil" data-acao="bilhetes" aria-label="Bilhetes">' + ICONES.bilhetes + '<span class="bbnum bbnbil" hidden></span></button>' +
            '<button type="button" class="bbferramenta bbfint" data-acao="interacoes" aria-label="Interações">' + ICONES.interacoes + '<span class="bbnum bbnint" hidden></span></button>' +
            '<div class="bbmais">' +
              '<button type="button" class="bbferramenta bbfmais" data-acao="menu" aria-label="Mais opções" aria-expanded="false">' + ICONES.mais + '<span class="bbnum bbnconv" hidden></span></button>' +
              '<div class="bbmenu" hidden>' +
                '<button type="button" class="bbmenuitem bbmranking" data-acao="ranking"><i class="fa-solid fa-award"></i> Ranking</button>' +
                '<button type="button" class="bbmenuitem bbmhistorico" data-acao="historico">Histórico</button>' +
                '<button type="button" class="bbmenuitem bbmmarcos" data-acao="marcos">Marcos</button>' +
                '<button type="button" class="bbmenuitem bbmlivros" data-acao="livros">Livros</button>' +
                '<button type="button" class="bbmenuitem bbmdupla" data-acao="dupla">Dupla <span class="bbmenunum" hidden></span></button>' +
              '</div>' +
            '</div>' +
          '</nav>' +
          '<div class="bbcrono">' +
            '<div class="bbcronotempo">0:00:00</div>' +
            '<div class="bbcronolimite"></div>' +
          '</div>' +
        '</div>' +
      '</header>' +
      '<div class="bbcorpo">' +
        '<aside class="bblado"></aside>' +
        '<main class="bbconteudo">' +
          '<section class="bbsalao" data-andar-secao="1"></section>' +
          '<section class="bbrestrita" data-andar-secao="2" hidden></section>' +
          '<section class="bbinferior" data-andar-secao="3" hidden></section>' +
        '</main>' +
      '</div>' +
      '<div class="bbmodal" hidden><div class="bbjanela" role="dialog" aria-modal="true"></div></div>' +
      '<div class="bbconfbox" hidden><div class="bbconfcaixa" role="alertdialog" aria-modal="true"></div></div>' +
      '<div class="bbtoast" role="status" aria-live="polite" hidden></div>';
    marcarAndar();
  }

  function q(sel) { return S.raiz.querySelector(sel); }

  var toastTimer = null;
  function toast(msg, erro) {
    var t = q('.bbtoast');
    t.textContent = msg;
    t.className = 'bbtoast' + (erro ? ' bberro' : '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3500);
  }

 
  function abrirModal(tipo, html) {
    var m = q('.bbmodal'), c = q('.bbjanela');
    c.className = 'bbjanela bbj' + tipo.replace(/-/g, '');
    c.innerHTML = '<button type="button" class="bbfechar" data-acao="fechar-modal" aria-label="Fechar">×</button>' + html;
    m.hidden = false;
    fecharMenu();
  }
  function fecharModal() { q('.bbmodal').hidden = true; }
  function mensagem(texto, tipo) {
    abrirModal('mensagem' + (tipo ? ' bbj' + tipo : ''), '<p class="bbmsg">' + esc(texto) + '</p>');
  }

  var confirmarResolver = null;
  function confirmar(texto, rotulo) {
    var box = q('.bbconfbox'), c = q('.bbconfcaixa');
    c.innerHTML =
      '<p class="bbconftexto">' + esc(texto).replace(/\n/g, '<br>') + '</p>' +
      '<div class="bbconfbotoes">' +
        '<button type="button" class="bbbtn bbcancelar" data-acao="confirmar-nao">Cancelar</button>' +
        '<button type="button" class="bbbtn bbconfirmar" data-acao="confirmar-sim">' + esc(rotulo || 'Confirmar') + '</button>' +
      '</div>';
    box.hidden = false;
    c.querySelector('.bbbtn.bbconfirmar').focus();
    return new Promise(function (resolve) { confirmarResolver = resolve; });
  }
  function responderConfirmar(sim) {
    q('.bbconfbox').hidden = true;
    if (confirmarResolver) { var r = confirmarResolver; confirmarResolver = null; r(sim); }
  }

  function abrirMenu() {
    var menu = q('.bbmenu'), b = q('.bbferramenta.bbfmais');
    var abrir = menu.hidden;
    menu.hidden = !abrir;
    b.setAttribute('aria-expanded', String(abrir));
  }
  function fecharMenu() {
    var menu = q('.bbmenu');
    if (menu && !menu.hidden) { menu.hidden = true; q('.bbferramenta.bbfmais').setAttribute('aria-expanded', 'false'); }
  }
 

  function ativaValida(s) { return s && typeof s.inicio_em === 'number' && typeof s.termina_em === 'number'; }

  async function atualizar(forcar) {
    if (S.atualizando) return;
    if (!forcar && document.visibilityState === 'hidden') return;
    S.atualizando = true;
    try {
      var r = await Promise.all([req('biblioteca/ativas'), req(caminho('biblioteca/naolidos', S.eu))]);
      S.ativas = r[0] || {};
      if (!S.relogioOk) await sincronizarRelogio();
      var t = agora(), lixo = {};
      Object.keys(S.ativas).forEach(function (k) {
        var s = S.ativas[k];
        if (!ativaValida(s)) { lixo['biblioteca/ativas/' + k] = null; delete S.ativas[k]; return; }
        if (S.relogioOk && s.termina_em <= t) fecharSessao(s, 'tempo').then(function (ok) { if (ok && k === S.eu) aposFecharMinha(); });
      });
      if (Object.keys(lixo).length) gravarVarios(lixo).catch(function () {});

      var minha = S.ativas[S.eu];
      var antes = S.minha;
      S.minha = minha && minha.termina_em > t ? minha : null;
      if (antes && !S.minha) aposFecharMinha();

      if (r[1] === null) await migrarNaoLidos();
      else S.naolidos = r[1] || {};

      S.envios = S.minha ? ((await req(caminho('biblioteca/interacoes-enviadas', S.eu, diaKey(t)))) || {}) : {};
      renderSalao();
      renderLateral();
      renderAvisos();
    } catch (e) {
      console.error('[Biblioteca] Falha ao atualizar:', e);
    } finally {
      S.atualizando = false;
    }
  }

  async function migrarNaoLidos() {
    try {
      var r = await Promise.all([
        req(caminho('biblioteca/bilhetes', S.eu)), req(caminho('biblioteca/interacoes', S.eu)), req(caminho('biblioteca/convites', S.eu))
      ]);
      var hoje = diaKey(agora());
      var n = {
        bilhetes: Object.values(r[0] || {}).filter(function (b) { return b && !b.lido; }).length,
        interacoes: Object.values(r[1] || {}).filter(function (i) { return i && !i.visto; }).length,
        convites: Object.values(r[2] || {}).filter(function (c) { return c && !c.aceito && !c.expirado && diaKey(c.ts) === hoje; }).length
      };
      S.naolidos = n;
      await req(caminho('biblioteca/naolidos', S.eu), 'PUT', n);
    } catch (e) { S.naolidos = {}; }
  }

  function renderAvisos() {
    var n = S.naolidos || {};
    [['bilhetes', '.bbnum.bbnbil'], ['interacoes', '.bbnum.bbnint'], ['convites', '.bbnum.bbnconv']].forEach(function (par) {
      var el = q(par[1]), v = Math.max(0, num(n[par[0]], 0));
      el.textContent = v; el.hidden = v === 0;
    });
    var mi = q('.bbmenunum'), c = Math.max(0, num(n.convites, 0));
    mi.textContent = c; mi.hidden = c === 0;
  }

  async function zerarNaoLido(campo) {
    if (!num((S.naolidos || {})[campo], 0)) return;
    S.naolidos[campo] = 0; renderAvisos();
    try { await req(caminho('biblioteca/naolidos', S.eu, campo), 'PUT', 0); } catch (e) {}
  }

   

  async function carregarHoje() {
    S.diaAtual = diaKey(agora());
    try { S.hojeReais = num(await req(caminho('biblioteca/hoje', S.diaAtual, S.eu)), 0); } catch (e) {}
  }

  function tick() {
    var t = agora();
    if (diaKey(t) !== S.diaAtual) carregarHoje();
    var total = S.hojeReais * 3600000;
    if (S.minha && diaKey(S.minha.inicio_em) === S.diaAtual) total += Math.max(0, Math.min(t, S.minha.termina_em) - S.minha.inicio_em);
    q('.bbcronotempo').textContent = fmtRelogio(total);
    q('.bbcronolimite').textContent = 'de ' + String(S.cfg.geral.limite_diario_h).replace('.', ',') + ' horas hoje';
    q('.bbcrono').classList.toggle('bbestudando', !!S.minha);
    if (S.minha && S.relogioOk && t >= S.minha.termina_em && !S.fechandoMinha && Date.now() >= (S.proximaTentativa || 0)) {
      var s = S.minha;
      S.fechandoMinha = true;
      fecharSessao(s, 'tempo').then(function (ok) {
        S.fechandoMinha = false;
        if (ok === true) { S.minha = null; return aposFecharMinha().then(function () { return atualizar(true); }); }
        S.proximaTentativa = Date.now() + 15000;
        delete S.fechando[fk(s.uid) + '_' + Math.round(s.inicio_em)];
        return atualizar(true);
      });
    }
  }

  async function aposFecharMinha() {
    S.minha = null;
    await Promise.all([carregarHoje(), carregarProgresso()]);
    if (S.andar !== 1) irParaAndar(1, true);
    renderSalao(); renderLateral();
  }



  async function carregarProgresso() {
    try { S.progresso = (await req(caminho('biblioteca/progresso', S.eu, mesKey(agora())))) || {}; } catch (e) { S.progresso = {}; }
  }

  function proximoMarco(total, resgatados) {
    var lista = Object.keys(S.cfg.marcos).map(function (k) { return S.cfg.marcos[k]; })
      .filter(Boolean).sort(function (a, b) { return a.horas - b.horas; });
    return lista.filter(function (m) { return resgatados.indexOf(m.horas) === -1 && total < m.horas; })[0] || null;
  }

  function renderLateral() {
    var el = q('.bblado');
    var at = S.atributos || {};
    var b = bonusAtributos(at);
    var prog = S.progresso || {};
    var total = num(prog.horas_efetivas, 0);
    var resg = Array.isArray(prog.marcos_resgatados) ? prog.marcos_resgatados : Object.values(prog.marcos_resgatados || {});
    var prox = proximoMarco(total, resg);
    var s = S.minha;

    var html =
      '<div class="bbatributos">' +
        '<div class="bbatributo bbaint"><span class="bbatrot">Inteligência</span><span class="bbatval">' + esc(num(at.inteligencia, 0)) + '</span>' + (S.cfg.atributos.int_aplicar ? '<span class="bbatbonus">+' + b.int + '% horas</span>' : '') + '</div>' +
        '<div class="bbatributo bbadet"><span class="bbatrot">Determinação</span><span class="bbatval">' + esc(num(at.determinacao, 0)) + '</span><span class="bbatbonus">−' + b.det + ' de energia ao entrar</span></div>' +
        '<div class="bbatributo bbasab"><span class="bbatrot">Sabedoria</span><span class="bbatval">' + esc(num(at.sabedoria, 0)) + '</span>' + (S.cfg.atributos.sab_aplicar ? '<span class="bbatbonus">+' + b.sab + '% em bônus recebidos</span>' : '') + '</div>' +
      '</div>' +
      '<div class="bbprog">' +
        '<span class="bbprogrot">Horas este mês</span>' +
        '<span class="bbprogval">' + fmtHoras(total) + '</span>' +
        (prox
          ? '<div class="bbprogbarra"><span class="bbprogfill" style="--bbprog:' + Math.min(100, Math.round(total / prox.horas * 100)) + '%"></span></div>' +
            '<span class="bbprogmarco">Próximo marco: ' + fmtHoras(prox.horas) + '</span>'
          : '<span class="bbprogmarco bbcompleto">Todos os marcos do mês conquistados</span>') +
      '</div>';

    if (s) {
      var pct = bonusAtualPct(s);
      html +=
        '<div class="bblendo">' +
          '<span class="bblendorot">' + (s.livro ? 'Lendo' : 'Estudando') + '</span>' +
          (s.livro ? '<span class="bblendolivro">' + esc(s.livro) + '</span>' : '<span class="bblendolivro bbemprestado">com livro emprestado</span>') +
          '<span class="bblendomesa">' + esc(s.mesa_nome || '') + '</span>' +
          (pct !== 0 ? '<span class="bblendobonus">Bônus atual ' + (pct > 0 ? '+' : '') + pct + '%</span>' : '') +
        '</div>' +
        '<button type="button" class="bbbtn bbsair" data-acao="sair">Sair da biblioteca</button>';
    }
    el.innerHTML = html;
  }



  function interacoesOrdenadas() { return ordenar(S.cfg.interacoes).map(function (id) { return Object.assign({ id: id }, S.cfg.interacoes[id]); }); }

  function estadoInteracao(it, alvoSessao) {
    var envios = S.envios || {};
    var alvoK = fk(alvoSessao.uid);
    var jaUsou = envios.alvos && envios.alvos[alvoK] && envios.alvos[alvoK][it.id];
    var mesaAlvo = mesa(alvoSessao.mesa_id) || {};
    var minhaMesa = mesa(S.minha.mesa_id) || {};
    if (num(it.bonus_pct, 0) < 0 && mesaAlvo.imune_atrapalhar) return { usado: true, motivo: 'Imune nesta mesa' };
    if (jaUsou) return { usado: true, motivo: 'Já usado hoje com esta pessoa' };
    var livre = num(it.bonus_pct, 0) < 0 && minhaMesa.atrapalhar_livre;
    if (!livre && num(envios[it.id], 0) >= num(it.limite_dia, 0)) return { usado: true, motivo: 'Limite do dia atingido' };
    return { usado: false };
  }

  function descricaoInteracao(it) {
    var b = num(it.bonus_pct, 0), hp = num(it.hp, 0), p = [];
    if (b > 0) p.push('+' + b + '% nas horas');
    if (b < 0) p.push(b + '% nas horas');
    if (hp) p.push((hp > 0 ? '+' : '') + hp + ' de HP');
    return it.nome + (p.length ? ' (' + p.join(', ') + ')' : '');
  }

  function renderSalao() {
    var el = q('.bbsalao');
    var foco = document.activeElement;
    if (foco && foco.classList && foco.classList.contains('bbcardcampo')) return;
    var t = agora();
    var lista = Object.keys(S.ativas).map(function (k) { return S.ativas[k]; })
      .filter(function (s) { return ativaValida(s) && s.termina_em > t; })
      .sort(function (a, b) {
        var ma = num((mesa(a.mesa_id) || {}).ordem, 99), mb = num((mesa(b.mesa_id) || {}).ordem, 99);
        return (ma - mb) || String(a.nome).localeCompare(String(b.nome), 'pt-BR');
      });

    var html = '<div class="bbsalaotopo"><h2 class="bbsalaotit">Estudando agora</h2><span class="bbsalaocont">' +
      lista.length + (lista.length === 1 ? ' pessoa' : ' pessoas') + '</span></div>';

    if (!S.minha) {
      html += '<div class="bbentrada"><button type="button" class="bbbtn bbentrar" data-acao="entrar">Entrar na biblioteca</button></div>';
    }

    if (!lista.length) {
      html += '<p class="bbsalaovazio">A biblioteca está vazia.</p>';
    } else {
      html += '<ul class="bblista">' + lista.map(function (s) {
        var k = fk(s.uid), eu = k === S.eu, m = mesa(s.mesa_id) || {};
        var cor = /^#[0-9a-f]{3,8}$/i.test(m.cor || '') ? m.cor : '#888888';
        var acoes = '';
        if (S.minha && !eu) {
          acoes = '<div class="bbcardacoes">' + interacoesOrdenadas().map(function (it) {
            var e = estadoInteracao(it, s);
            return '<button type="button" class="bbint bbi' + esc(String(it.id).replace(/[^a-zA-Z0-9]/g, '')) + (e.usado ? ' bbusada' : '') + '"' +
              ' data-acao="interagir" data-alvo="' + esc(k) + '" data-tipo="' + esc(it.id) + '"' + (e.usado ? ' disabled' : '') +
              ' title="' + esc(e.usado ? e.motivo : descricaoInteracao(it)) + '">' + esc(it.nome) + '</button>';
          }).join('') + '</div>';
        }
        var status = eu
          ? '<input class="bbcardcampo" type="text" maxlength="' + num(S.cfg.geral.status_max, 150) + '" value="' + esc(s.status || '') + '" aria-label="Seu status" placeholder="Seu status">'
          : '<span class="bbcardstatus">' + rico(s.status || '') + '</span>';
        return '<li class="bbcard' + (eu ? ' bbvoce' : '') + '" data-mesa="' + esc(s.mesa_id || '') + '" data-uid="' + esc(k) + '" style="--bbcor:' + cor + '">' +
          '<span class="bbcardcor" aria-hidden="true"></span>' +
          '<div class="bbcardinfo">' +
            '<span class="bbcardnome">' + esc(s.nome || k) + (eu ? ' <span class="bbcardvoce">você</span>' : '') + '</span>' +
            '<span class="bbcarddet"><span class="bbcardmesa">' + esc(s.mesa_nome || '') + '</span>' +
              '<span class="bbcardlivro' + (s.livro ? '' : ' bbemprestado') + '">' + esc(s.livro || 'livro emprestado') + '</span></span>' +
          '</div>' +
          status +
          '<span class="bbcardtempo" title="Tempo restante">' + fmtHoras((s.termina_em - t) / 3600000) + '</span>' +
          acoes +
        '</li>';
      }).join('') + '</ul>';
    }
    el.innerHTML = html;
  }

  async function salvarStatus(input) {
    if (!S.minha) return;
    var texto = input.value.trim().slice(0, num(S.cfg.geral.status_max, 150));
    if (texto === (S.minha.status || '')) return;
    try {
      await req(caminho('biblioteca/ativas', S.eu, 'status'), 'PUT', texto);
      S.minha.status = texto;
      toast('Status atualizado.');
    } catch (e) { toast('Falha ao salvar o status: ' + e.message, true); }
  }

 
  async function interagir(btn) {
    if (!S.minha) return;
    var alvo = btn.dataset.alvo, tipo = btn.dataset.tipo;
    var it = Object.assign({ id: tipo }, S.cfg.interacoes[tipo] || {});
    btn.disabled = true;
    try {
      var r = await Promise.all([req(caminho('biblioteca/ativas', alvo)), req(caminho('biblioteca/interacoes-enviadas', S.eu, diaKey(agora())))]);
      var sessaoAlvo = r[0];
      S.envios = r[1] || {};
      if (!ativaValida(sessaoAlvo) || sessaoAlvo.termina_em <= agora()) { toast('Essa pessoa já saiu da biblioteca.', true); return atualizar(true); }
      var e = estadoInteracao(it, sessaoAlvo);
      if (e.usado) { toast(e.motivo + '.', true); return renderSalao(); }

      var dia = diaKey(agora()), m = {};
      m['biblioteca/interacoes-enviadas/' + S.eu + '/' + dia + '/' + tipo] = soma(1);
      m['biblioteca/interacoes-enviadas/' + S.eu + '/' + dia + '/alvos/' + alvo + '/' + tipo] = true;
      m['biblioteca/interacoes/' + alvo + '/' + gerarId()] = {
        tipo: tipo, label: it.nome, remetente_nome: S.user.nome, remetente_uid: S.eu,
        bonus: num(it.bonus_pct, 0) || null, hp: num(it.hp, 0) || null, visto: false, ts: TS
      };
      m['biblioteca/naolidos/' + alvo + '/interacoes'] = soma(1);
      var b = num(it.bonus_pct, 0);
      if (b > 0) m['biblioteca/ativas/' + alvo + '/bonus_pos'] = soma(b);
      if (b < 0) m['biblioteca/ativas/' + alvo + '/bonus_neg'] = soma(b);
      if (num(it.hp, 0)) m['status-perfil/' + alvo + '/hp_cur'] = soma(num(it.hp, 0));
      await gravarVarios(m);

      if (num(it.hp, 0) < 0) {
         var hp = await req(caminho('status-perfil', alvo, 'hp_cur'));
        if (typeof hp === 'number' && hp < 0) await req(caminho('status-perfil', alvo, 'hp_cur'), 'PUT', 0);
      }
      toast(it.nome + ' enviado para ' + (sessaoAlvo.nome || alvo) + '.');
      S.envios = (await req(caminho('biblioteca/interacoes-enviadas', S.eu, dia))) || {};
      renderSalao();
    } catch (err) {
      toast('Falha na interação: ' + err.message, true);
      btn.disabled = false;
    }
  }



  async function abrirEntrada() {
    var t = agora(), hora = partes(t).hora, g = S.cfg.geral;
    if (hora < num(g.abre, 6) || hora >= num(g.fecha, 23)) {
      return mensagem('A biblioteca está fechada. Horário de funcionamento: ' + g.abre + 'h às ' + g.fecha + 'h.');
    }
    if (S.minha) return;
    abrirModal('entrada', '<p class="bbmsg">Carregando…</p>');
    try {
      var dia = diaKey(t);
      var r = await Promise.all([
        req(caminho('biblioteca/acesso/geral', S.eu)),
        req(caminho('biblioteca/hoje', dia, S.eu)),
        req('biblioteca/ativas'),
        req(caminho('inventario', S.eu)),
        req(caminho('status-perfil', S.eu)),
        req(caminho('biblioteca/mesa-hoje', dia, S.eu)),
        req(caminho('biblioteca/vagas', dia)),
        req(caminho('atributos', S.eu))
      ]);
      if (!r[0]) return mensagem('Você não tem permissão para entrar na biblioteca.');
      S.hojeReais = num(r[1], 0);
      var ativas = r[2] || {}, inv = r[3] || {}, perfil = r[4] || {}, mesaHoje = r[5] || null, vagas = r[6] || {};
      S.atributos = r[7] || S.atributos || {};
      var restante = num(g.limite_diario_h, 6) - S.hojeReais;
      var opcoes = (g.opcoes_horas || []).map(Number).filter(function (h) { return h > 0 && h <= restante + 1e-6; }).sort(function (a, b) { return a - b; });
      if (!opcoes.length) return mensagem('Você já estudou ' + fmtHoras(S.hojeReais) + ' hoje e atingiu o limite de ' + fmtHoras(g.limite_diario_h) + '.');

      var livros = [];
      Object.keys(inv).forEach(function (k) {
        var it = inv[k];
        if (it && it.categoria === 'Livros' && it.nome && livros.indexOf(it.nome) === -1) livros.push(it.nome);
      });
      livros.sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });

      var mesaHojeCfg = mesaHoje ? mesa(mesaHoje) : null;
      var mesas = ordenar(S.cfg.mesas).map(function (id) {
        var m = S.cfg.mesas[id];
        var ocupados = Object.keys(ativas).filter(function (k) { var s = ativas[k]; return ativaValida(s) && s.termina_em > t && s.mesa_id === id; }).length;
        var motivo = null;
        if (num(m.limite, 0) > 0 && ocupados >= num(m.limite, 0)) motivo = 'Cheia';
        if (num(m.vagas_dia, 0) > 0 && num(vagas[id], 0) >= num(m.vagas_dia, 0)) motivo = 'Sem vagas hoje';
        if (mesaHojeCfg && mesaHojeCfg.exclusiva_dia && mesaHoje !== id) motivo = 'Você já usou ' + mesaHojeCfg.nome + ' hoje';
        if (mesaHoje && m.exclusiva_dia && mesaHoje !== id) motivo = 'Indisponível: você já usou outra mesa hoje';
        return { id: id, m: m, motivo: motivo };
      });

      var det = bonusAtributos(S.atributos).det;
      S.entrada = { mesa: null, horas: null, energia: num(perfil.energia_cur, 0), det: det, mesas: mesas, vagas: vagas };

      abrirModal('entrada',
        '<div class="bbform">' +
          '<fieldset class="bbformmesas"><legend class="bbformtit">Mesa</legend>' +
            mesas.map(function (x) {
              var cor = /^#[0-9a-f]{3,8}$/i.test(x.m.cor || '') ? x.m.cor : '#888888';
              return '<button type="button" class="bbopmesa" data-acao="escolher-mesa" data-mesa="' + esc(x.id) + '" style="--bbcor:' + cor + '"' + (x.motivo ? ' disabled' : '') + '>' +
                '<span class="bbopmesanome">' + esc(x.m.nome) + '</span>' +
                '<span class="bbopmesadesc">' + esc(x.motivo || x.m.descricao || '') + '</span></button>';
            }).join('') +
          '</fieldset>' +
          '<label class="bbformlivro"><span class="bbformtit">Livro</span>' +
            '<select class="bbformselect"><option value="">Livro emprestado</option>' +
              livros.map(function (l) { return '<option value="' + esc(l) + '">' + esc(l) + '</option>'; }).join('') +
            '</select></label>' +
          '<fieldset class="bbformhoras"><legend class="bbformtit">Horas</legend>' +
            opcoes.map(function (h) { return '<button type="button" class="bbophora" data-acao="escolher-hora" data-horas="' + h + '">' + fmtHoras(h) + '</button>'; }).join('') +
          '</fieldset>' +
          '<p class="bbforminfo">Escolha a mesa e o tempo de estudo. Hoje você ainda pode estudar ' + fmtHoras(restante) + '.</p>' +
          '<button type="button" class="bbbtn bbconfentrada" data-acao="confirmar-entrada" disabled>Entrar</button>' +
        '</div>');
    } catch (e) {
      mensagem('Não foi possível abrir a entrada: ' + e.message, 'erro');
    }
  }

  function custoEntrada() {
    var e = S.entrada, m = mesa(e.mesa);
    return Math.max(0, num(m.energia_h, 0) * e.horas - e.det);
  }

  function atualizarInfoEntrada() {
    var e = S.entrada, info = q('.bbforminfo'), btn = q('.bbbtn.bbconfentrada');
    if (!e.mesa || !e.horas) return;
    var m = mesa(e.mesa), custo = custoEntrada();
    info.textContent = m.nome + ' · ' + fmtHoras(e.horas) + ' · custa ' + custo + ' de energia (você tem ' + e.energia + ')';
    btn.disabled = false;
  }

  function escolher(el, tipo) {
    q(tipo === 'mesa' ? '.bbformmesas' : '.bbformhoras').querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('bbsel', b === el);
      b.setAttribute('aria-pressed', String(b === el));
    });
    if (tipo === 'mesa') S.entrada.mesa = el.dataset.mesa;
    else S.entrada.horas = Number(el.dataset.horas);
    atualizarInfoEntrada();
  }

  async function confirmarEntrada(btn) {
    var e = S.entrada;
    if (!e || !e.mesa || !e.horas) return;
    var m = mesa(e.mesa), custo = custoEntrada();
    if (e.energia < custo) return toast('Energia insuficiente: precisa de ' + custo + ', você tem ' + e.energia + '.', true);
    btn.disabled = true;
    try {
      var existente = await req(caminho('biblioteca/ativas', S.eu));
      if (ativaValida(existente) && existente.termina_em > agora()) { fecharModal(); return atualizar(true); }
      var livro = q('.bbformselect').value || null;
      var inicio = await horaServidor(), dia = diaKey(inicio);
      var b = bonusAtributos(S.atributos);
      var sessao = {
        uid: S.eu, nome: S.user.nome, inicio_em: inicio, termina_em: inicio + e.horas * 3600000, horas: e.horas,
        mesa_id: e.mesa, mesa_nome: m.nome, mesa_bonus_pct: num(m.bonus_pct, 0), livro: livro, status: 'Estudando',
        int_pct: S.cfg.atributos.int_aplicar ? b.int : 0, sab_pct: S.cfg.atributos.sab_aplicar ? b.sab : 0,
        bonus_pos: 0, bonus_neg: 0, bonus_dupla_pct: 0
      };
      var w = {};
      w['biblioteca/ativas/' + S.eu] = sessao;
      if (custo) w['status-perfil/' + S.eu + '/energia_cur'] = soma(-custo);
      w['biblioteca/mesa-hoje/' + dia + '/' + S.eu] = e.mesa;
      if (num(m.vagas_dia, 0) > 0) w['biblioteca/vagas/' + dia + '/' + e.mesa] = soma(1);
      await gravarVarios(w);
      S.minha = sessao;
      S.ativas[S.eu] = sessao;
      fecharModal();
      toast('Bons estudos!');
      await atualizar(true);
    } catch (err) {
      btn.disabled = false;
      toast('Falha ao entrar: ' + err.message, true);
    }
  }

  async function sair() {
    if (!S.minha) return;
    if (!(await confirmar('Sair da biblioteca? Suas horas até agora serão registradas.', 'Sair'))) return;
    var s = S.minha;
    var ok = await fecharSessao(s, 'saida');
        if (ok === false) toast('A sessão já está sendo encerrada em outra aba.', true);
    await aposFecharMinha();
    await atualizar(true);
  }



  function marcarAndar() {
    S.raiz.querySelectorAll('.bbandar').forEach(function (b) {
      var atual = Number(b.dataset.andar) === S.andar;
      b.classList.toggle('bbatual', atual);
      if (atual) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    S.raiz.querySelectorAll('[data-andar-secao]').forEach(function (s) { s.hidden = Number(s.dataset.andarSecao) !== S.andar; });
    S.raiz.setAttribute('data-andar-atual', String(S.andar));
  }

   function trocarAndar(n) { S.andar = n; marcarAndar(); }

  async function irParaAndar(n, semVerificar) {
    if (n === 1 || semVerificar) { trocarAndar(n); if (n === 1) renderSalao(); return; }
    if (!S.minha) return mensagem('Você precisa estar estudando na biblioteca para acessar esta área.');
    try {
      var acesso = await req(caminho('biblioteca/acesso/restrita', S.eu));
      if (!acesso) return mensagem('Você não tem acesso à sessão restrita.');
      if (n === 3) {
        var at = (await req(caminho('atributos', S.eu))) || {};
        var inf = S.cfg.inferior;
        if (num(at.resistencia, 0) < num(inf.resistencia, 0) || num(at.sabedoria, 0) < num(inf.sabedoria, 0)) {
          return mensagem('Para descer ao andar inferior você precisa de Resistência ' + inf.resistencia + ' e Sabedoria ' + inf.sabedoria + '.', 'bloqueado');
        }
        trocarAndar(3);
        renderInferior();
      } else {
        trocarAndar(2);
        renderRestrita();
      }
    } catch (e) { toast('Falha ao abrir o andar: ' + e.message, true); }
  }

 
  async function renderRestrita() {
    var el = q('.bbrestrita');
    el.innerHTML = '<p class="bbrestcarreg">Carregando…</p>';
    try {
      var dia = diaKey(agora());
      var r = await Promise.all([req('restrita/itens'), req(caminho('restrita/progresso', S.eu)), req(caminho('restrita/hoje', dia, S.eu))]);
      var itens = r[0] || {}, prog = r[1] || {}, hoje = r[2] || null;
      S.restrita = { itens: itens, prog: prog };
      var ids = Object.keys(itens).filter(function (k) { return itens[k]; });
      if (!ids.length) { el.innerHTML = '<p class="bbrestvazio">Nenhum item disponível ainda.</p>'; return; }
      el.innerHTML = '<div class="bbgrade">' + ids.map(function (id) {
        var it = itens[id], ip = prog[id] || {};
        var dias = Array.isArray(ip.dias) ? ip.dias : Object.values(ip.dias || {});
        var meta = Math.max(1, num(it.dias, 1));
        var pct = Math.min(100, Math.round(dias.length / meta * 100));
        var acao;
        if (ip.resgatado) acao = '<span class="bbritestado bbresgatado">Resgatado</span>';
        else if (dias.length >= meta) acao = '<button type="button" class="bbbtn bbritresg" data-acao="ritual-resgatar" data-id="' + esc(id) + '">Resgatar</button>';
        else if (hoje === id) acao = '<span class="bbritestado bbfeito">Feito hoje</span>';
        else if (hoje) acao = '<button type="button" class="bbbtn bbritbloq" disabled>Amanhã</button>';
        else acao = '<button type="button" class="bbbtn bbritacao" data-acao="ritual-acao" data-id="' + esc(id) + '">' + esc(it.botao || 'Estudar') + '</button>';
        return '<div class="bbritual" data-ritual="' + esc(id) + '">' +
          (it.imagem ? '<img class="bbritimg" src="' + esc(it.imagem) + '" alt="">' : '') +
          '<span class="bbritnome">' + esc(it.nome) + '</span>' +
          '<span class="bbritprog">' + dias.length + '/' + meta + ' dias</span>' +
          '<span class="bbritbarra"><span class="bbritfill" style="--bbprog:' + pct + '%"></span></span>' +
          acao + '</div>';
      }).join('') + '</div>';
    } catch (e) { el.innerHTML = '<p class="bbresterro">Falha ao carregar: ' + esc(e.message) + '</p>'; }
  }

  async function ritualAcao(btn) {
    var id = btn.dataset.id, dia = diaKey(agora());
    btn.disabled = true;
    try {
      var hoje = await req(caminho('restrita/hoje', dia, S.eu));
      if (hoje) { toast('Você já fez um estudo restrito hoje.', true); return renderRestrita(); }
      var ip = (S.restrita.prog || {})[id] || {};
      var dias = Array.isArray(ip.dias) ? ip.dias.slice() : Object.values(ip.dias || {});
      if (dias.indexOf(dia) === -1) dias.push(dia);
      var m = {};
      m['restrita/progresso/' + S.eu + '/' + id] = { dias: dias, resgatado: false };
      m['restrita/hoje/' + dia + '/' + S.eu] = id;
      await gravarVarios(m);
      renderRestrita();
    } catch (e) { btn.disabled = false; toast('Falha: ' + e.message, true); }
  }

  async function ritualResgatar(btn) {
    var id = btn.dataset.id, it = (S.restrita.itens || {})[id];
    if (!it) return;
    if (!(await confirmar('Resgatar ' + (it.item_nome || it.nome) + '?' + (it.item_desc ? '\n\n' + it.item_desc : ''), 'Resgatar'))) return;
    btn.disabled = true;
    try {
      var trava = await travar('restrita_' + S.eu + '_' + chaveSegura(id));
      if (!trava) { toast('Esse resgate já está sendo feito.', true); return; }
      var ip = await req(caminho('restrita/progresso', S.eu, id));
      if (ip && ip.resgatado) { toast('Já resgatado.', true); return renderRestrita(); }
      var m = {};
      m['inventario/' + S.eu + '/' + gerarId()] = {
        nome: it.item_nome || it.nome, descricao: it.item_desc || '', categoria: it.item_categoria || 'Off-Game',
        icone: it.imagem || null, imagem: it.imagem || null, valor: 0, quantidade: 1, origem: 'restrita'
      };
      m['restrita/progresso/' + S.eu + '/' + id + '/resgatado'] = true;
      travaFeita(m, trava);
      await gravarVarios(m);
      toast((it.item_nome || it.nome) + ' foi para o seu inventário.');
      renderRestrita();
    } catch (e) { btn.disabled = false; toast('Falha: ' + e.message, true); }
  }
 
  async function renderInferior() {
    var el = q('.bbinferior');
    el.innerHTML = '<p class="bbinfcarreg">Carregando…</p>';
    try {
      var r = await Promise.all([req('andar3/icones'), req('andar3/drops'), req(caminho('andar3/hoje', diaKey(agora()), S.eu))]);
      var icones = r[0] || {}, jaAgiu = !!r[2];
      S.inferior = { drops: r[1] || {} };
      var html = '<div class="bbsala' + (jaAgiu ? ' bbusada' : '') + '">';
      for (var i = 1; i <= 10; i++) {
        var ic = (Array.isArray(icones) ? icones[i] : icones[i] || icones[String(i)]) || {};
        var pos = POSICOES_INFERIOR[i - 1];
        html += '<button type="button" class="bbicone bbic' + i + (jaAgiu ? ' bbusado' : '') + '" data-acao="icone" data-icone="' + i + '"' +
          ' style="--bbx:' + pos.left + ';--bby:' + pos.top + ';--bbw:' + esc(ic.width || '60px') + ';--bbh:' + esc(ic.height || '60px') + '"' +
          (jaAgiu ? ' disabled' : '') + ' aria-label="Investigar ponto ' + i + '">' +
          (ic.imagem ? '<img class="bbiconeimg" src="' + esc(ic.imagem) + '" alt="">' : '') + '</button>';
      }
      el.innerHTML = html + '</div>';
    } catch (e) { el.innerHTML = '<p class="bbinferro">Falha ao carregar: ' + esc(e.message) + '</p>'; }
  }

  async function clicarIcone(btn) {
    var iconeId = Number(btn.dataset.icone), dia = diaKey(agora());
    S.raiz.querySelectorAll('.bbicone').forEach(function (b) { b.disabled = true; b.classList.add('bbusado'); });
    try {
      var trava = await travar('inferior_' + S.eu + '_' + dia);
      var ja = await req(caminho('andar3/hoje', dia, S.eu));
      if (!trava || ja) { toast('Você já investigou o andar inferior hoje.', true); return; }
      var drops = S.inferior.drops || {};
      var pool = Object.keys(drops).filter(function (k) {
        var d = drops[k]; if (!d) return false;
        var lista = Array.isArray(d.icones) ? d.icones : Object.values(d.icones || {});
        return !lista.length || lista.map(Number).indexOf(iconeId) !== -1;
      });
      var ganhou = null;
      pool.forEach(function (k) { if (!ganhou && Math.random() * 100 < num(drops[k].chance, 0)) ganhou = drops[k]; });
      var m = {};
      m['andar3/hoje/' + dia + '/' + S.eu] = { icone_id: iconeId, ganhou: !!ganhou, item_nome: ganhou ? ganhou.nome : null };
      if (ganhou) {
        m['inventario/' + S.eu + '/' + gerarId()] = {
          nome: ganhou.nome, descricao: ganhou.desc || '', categoria: ganhou.categoria || 'Off-Game',
          icone: ganhou.imagem || null, imagem: ganhou.imagem || null, valor: 0, quantidade: 1, origem: 'andar3'
        };
        if (ganhou.eh_saude) m['andar3/notificacoes/' + gerarId()] = { uid: S.eu, nome: S.user.nome, item_nome: ganhou.nome, ts: TS, visto: false };
      }
      travaFeita(m, trava);
      await gravarVarios(m);
      if (!ganhou) abrirModal('inferior-nada', '<p class="bbmsg bbnada">Não há nada aqui.</p>');
      else abrirModal('inferior-achado',
        '<h2 class="bbtitulo">Você encontrou algo!</h2>' +
        (ganhou.imagem ? '<img class="bbachadoimg" src="' + esc(ganhou.imagem) + '" alt="">' : '') +
        '<p class="bbachadonome">' + esc(ganhou.nome) + '</p>' +
        (ganhou.desc ? '<p class="bbachadodesc">' + esc(ganhou.desc) + '</p>' : ''));
    } catch (e) { toast('Falha: ' + e.message, true); }
  }
 

  async function abrirBilhetes() {
    if (!S.minha) return mensagem('Você precisa estar estudando na biblioteca para acessar os bilhetes.');
    abrirModal('bilhetes', '<p class="bbmsg">Carregando…</p>');
    try {
      var bilhetes = (await req(caminho('biblioteca/bilhetes', S.eu))) || {};
      var ids = Object.keys(bilhetes).filter(function (k) { return bilhetes[k]; });
      var lista = ids.map(function (id) { return Object.assign({ _id: id }, bilhetes[id]); }).sort(function (a, b) { return num(b.ts, 0) - num(a.ts, 0); });
      var max = num(S.cfg.bilhetes.caixa_max, 20), cheia = lista.length >= max;
      abrirModal('bilhetes',
        '<h2 class="bbtitulo">Bilhetes</h2>' +
        '<div class="bbbiltopo">' +
          '<span class="bbbilcont' + (cheia ? ' bbcheia' : '') + '">' + lista.length + '/' + max + (cheia ? ' — caixa cheia' : '') + '</span>' +
          '<button type="button" class="bbbtn bbapagarlidos" data-acao="apagar-lidos">Apagar todos os lidos</button>' +
          '<button type="button" class="bbbtn bbescrever" data-acao="escrever-bilhete">Escrever bilhete</button>' +
        '</div>' +
        (!lista.length ? '<p class="bbbilvazio">Nenhum bilhete recebido.</p>' :
          '<ul class="bbbillista">' + lista.map(function (b) {
            return '<li class="bbbilhete' + (!b.lido ? ' bbnovo' : '') + '" data-id="' + esc(b._id) + '">' +
              '<div class="bbbilcab"><span class="bbbilrem">' + esc(b.remetente_nome) + '</span><span class="bbbildata">' + (b.ts ? fmtData(b.ts) : '') + '</span></div>' +
              '<div class="bbbiltexto">' + rico(b.mensagem) + '</div>' +
              (b.com_energia && !b.energia_resgatada ? '<button type="button" class="bbbtn bbresgenergia" data-acao="resgatar-energia" data-id="' + esc(b._id) + '">Resgatar +' + num(S.cfg.bilhetes.energia, 5) + ' de energia</button>' : '') +
              (b.com_energia && b.energia_resgatada ? '<span class="bbbilenergia">Energia resgatada</span>' : '') +
              '<button type="button" class="bbbilapagar" data-acao="apagar-bilhete" data-id="' + esc(b._id) + '" aria-label="Apagar bilhete">×</button>' +
            '</li>';
          }).join('') + '</ul>'));
      var m = {};
      lista.forEach(function (b) { if (!b.lido) m['biblioteca/bilhetes/' + S.eu + '/' + b._id + '/lido'] = true; });
      m['biblioteca/naolidos/' + S.eu + '/bilhetes'] = 0;
      S.naolidos.bilhetes = 0; renderAvisos();
      gravarVarios(m).catch(function () {});
      S.caixa = lista;
    } catch (e) { mensagem('Falha ao abrir os bilhetes: ' + e.message, 'erro'); }
  }

  async function apagarBilhete(btn) {
    btn.disabled = true;
    try {
      await req(caminho('biblioteca/bilhetes', S.eu, btn.dataset.id), 'DELETE');
      abrirBilhetes();
    } catch (e) { btn.disabled = false; toast('Falha ao apagar: ' + e.message, true); }
  }

  async function apagarLidos() {

    var alvo = (S.caixa || []).filter(function (b) { return b.lido && !(b.com_energia && !b.energia_resgatada); });
    if (!alvo.length) return toast('Não há bilhetes lidos para apagar.');
    if (!(await confirmar('Apagar ' + alvo.length + ' bilhete(s) lido(s)?\nBilhetes não lidos e com energia por resgatar ficam.', 'Apagar'))) return;
    var m = {};
    alvo.forEach(function (b) { m['biblioteca/bilhetes/' + S.eu + '/' + b._id] = null; });
    try { await gravarVarios(m); toast(alvo.length + ' bilhete(s) apagado(s).'); abrirBilhetes(); }
    catch (e) { toast('Falha ao apagar: ' + e.message, true); }
  }

  async function resgatarEnergia(btn) {
    var id = btn.dataset.id, e = num(S.cfg.bilhetes.energia, 5);
    btn.disabled = true;
    try {
      var trava = await travar('bilhete_' + S.eu + '_' + id);
      var b = await req(caminho('biblioteca/bilhetes', S.eu, id));
      if (!trava || !b || b.energia_resgatada) { toast('Essa energia já foi resgatada.', true); return abrirBilhetes(); }
      var m = {};
      m['biblioteca/bilhetes/' + S.eu + '/' + id + '/energia_resgatada'] = true;
      m['status-perfil/' + S.eu + '/energia_cur'] = soma(e);
      travaFeita(m, trava);
      await gravarVarios(m);
      var p = (await req(caminho('status-perfil', S.eu))) || {};
      if (typeof p.energia_tot === 'number' && num(p.energia_cur, 0) > p.energia_tot) {
        await req(caminho('status-perfil', S.eu, 'energia_cur'), 'PUT', p.energia_tot);
      }
      toast('+' + e + ' de energia.');
      abrirBilhetes();
    } catch (err) { btn.disabled = false; toast('Falha: ' + err.message, true); }
  }

  async function escreverBilhete() {
    abrirModal('enviar-bilhete', '<p class="bbmsg">Carregando…</p>');
    try {
      var dia = diaKey(agora()), cb = S.cfg.bilhetes;
      var r = await Promise.all([req(caminho('biblioteca/bilhetes-enviados', S.eu, dia)), req('biblioteca/acesso/geral'), carregarNomes()]);
      var env = r[0] || {}, total = num(env.total, 0), energiaUsada = num(env.energia, 0);
      if (total >= num(cb.por_dia, 5)) return mensagem('Você já enviou ' + cb.por_dia + ' bilhetes hoje.');
      var acesso = r[1] || {};
      var uids = Object.keys(acesso).filter(function (k) { return acesso[k] && k !== S.eu; })
        .sort(function (a, b) { return nomeDe(a).localeCompare(nomeDe(b), 'pt-BR'); });
      var podeEnergia = energiaUsada < num(cb.energia_por_dia, 3);
      abrirModal('enviar-bilhete',
        '<h2 class="bbtitulo">Escrever bilhete</h2>' +
        '<p class="bbenvrestantes">Você ainda pode enviar ' + (num(cb.por_dia, 5) - total) + ' bilhete(s) hoje.</p>' +
        '<label class="bbenvcampo"><span class="bbenvrot">Para</span><select class="bbenvdestino"><option value="">Escolha quem vai receber</option>' +
          uids.map(function (k) { return '<option value="' + esc(k) + '">' + esc(nomeDe(k)) + '</option>'; }).join('') + '</select></label>' +
        '<label class="bbenvcampo"><span class="bbenvrot">Mensagem</span><textarea class="bbenvtexto" maxlength="' + num(cb.max_caracteres, 300) + '" rows="5" placeholder="Negrito: <b>texto</b> · Itálico: <i>texto</i>"></textarea></label>' +
        (podeEnergia
          ? '<label class="bbenvenergia"><input type="checkbox" class="bbenvcaixa"> Incluir +' + num(cb.energia, 5) + ' de energia (' + (num(cb.energia_por_dia, 3) - energiaUsada) + ' restantes hoje)</label>'
          : '<p class="bbenvaviso">Você já enviou todos os bilhetes com energia de hoje.</p>') +
        '<button type="button" class="bbbtn bbenviarbil" data-acao="enviar-bilhete">Enviar</button>');
      S.envioBilhete = { podeEnergia: podeEnergia };
    } catch (e) { mensagem('Falha: ' + e.message, 'erro'); }
  }

  async function enviarBilhete(btn) {
    var dest = q('.bbenvdestino').value;
    var texto = q('.bbenvtexto').value.trim().slice(0, num(S.cfg.bilhetes.max_caracteres, 300));
    var caixa = q('.bbenvcaixa');
    var energia = !!(S.envioBilhete && S.envioBilhete.podeEnergia && caixa && caixa.checked);
    if (!dest) return toast('Escolha quem vai receber.', true);
    if (!texto) return toast('Escreva a mensagem.', true);
    btn.disabled = true;
    try {
      var dia = diaKey(agora());
      var r = await Promise.all([req(caminho('biblioteca/bilhetes', dest), 'GET', undefined, 'shallow=true'), req(caminho('biblioteca/bilhetes-enviados', S.eu, dia))]);
      var naCaixa = Object.keys(r[0] || {}).length, env = r[1] || {};
      if (naCaixa >= num(S.cfg.bilhetes.caixa_max, 20)) { btn.disabled = false; return mensagem('A caixa de entrada de ' + nomeDe(dest) + ' está cheia. O bilhete não foi enviado.'); }
      if (num(env.total, 0) >= num(S.cfg.bilhetes.por_dia, 5)) return mensagem('Você já enviou todos os bilhetes de hoje.');
      var m = {};
      m['biblioteca/bilhetes/' + dest + '/' + gerarId()] = {
        remetente_uid: S.eu, remetente_nome: S.user.nome, mensagem: texto,
        com_energia: energia, energia_resgatada: false, lido: false, ts: TS
      };
      m['biblioteca/naolidos/' + dest + '/bilhetes'] = soma(1);
      m['biblioteca/bilhetes-enviados/' + S.eu + '/' + dia + '/total'] = soma(1);
      if (energia) m['biblioteca/bilhetes-enviados/' + S.eu + '/' + dia + '/energia'] = soma(1);
      await gravarVarios(m);
      mensagem('Bilhete enviado para ' + nomeDe(dest) + '.');
    } catch (e) { btn.disabled = false; toast('Falha ao enviar: ' + e.message, true); }
  }



  async function abrirInteracoes(aba) {
    abrirModal('interacoes', '<p class="bbmsg">Carregando…</p>');
    try {
      var r = await Promise.all([req(caminho('biblioteca/interacoes', S.eu)), req(caminho('biblioteca/interacoes-enviadas', S.eu, diaKey(agora()))), carregarNomes()]);
      var rec = r[0] || {}, env = r[1] || {};
      var lista = Object.keys(rec).filter(function (k) { return rec[k]; }).map(function (k) { return Object.assign({ _id: k }, rec[k]); })
        .sort(function (a, b) { return num(b.ts, 0) - num(a.ts, 0); });
      var alvos = env.alvos || {};
      var enviadas = Object.keys(alvos).map(function (k) {
        return { nome: nomeDe(k), acoes: Object.keys(alvos[k]).map(function (t) { return (S.cfg.interacoes[t] || {}).nome || t; }).join(', ') };
      });
      aba = aba || 'recebidas';
      abrirModal('interacoes',
        '<h2 class="bbtitulo">Interações</h2>' +
        '<div class="bbabas" role="tablist">' +
          '<button type="button" role="tab" class="bbaba' + (aba === 'recebidas' ? ' bbatual' : '') + '" aria-selected="' + (aba === 'recebidas') + '" data-acao="interacoes-aba" data-aba="recebidas">Recebidas</button>' +
          '<button type="button" role="tab" class="bbaba' + (aba === 'enviadas' ? ' bbatual' : '') + '" aria-selected="' + (aba === 'enviadas') + '" data-acao="interacoes-aba" data-aba="enviadas">Enviadas hoje</button>' +
        '</div>' +
        (aba === 'recebidas'
          ? (!lista.length ? '<p class="bbintvazio">Nenhuma interação recebida.</p>' :
            '<ul class="bbintlista">' + lista.map(function (i) {
              return '<li class="bbrecebida' + (!i.visto ? ' bbnovo' : '') + '">' +
                '<span class="bbrecrem">' + esc(i.remetente_nome) + '</span>' +
                '<span class="bbrectipo">' + esc(i.label) + '</span>' +
                '<span class="bbrecdata">' + (i.ts ? fmtData(i.ts) : '') + '</span>' +
                '<button type="button" class="bbrecapagar" data-acao="apagar-interacao" data-id="' + esc(i._id) + '" aria-label="Apagar">×</button></li>';
            }).join('') + '</ul>')
          : (!enviadas.length ? '<p class="bbintvazio">Nenhuma interação enviada hoje.</p>' :
            '<ul class="bbintlista bbenviadas">' + enviadas.map(function (e) {
              return '<li class="bbenviada"><span class="bbenvnome">' + esc(e.nome) + '</span><span class="bbenvacoes">' + esc(e.acoes) + '</span></li>';
            }).join('') + '</ul>')));
      var m = {};
      lista.forEach(function (i) { if (!i.visto) m['biblioteca/interacoes/' + S.eu + '/' + i._id + '/visto'] = true; });
      m['biblioteca/naolidos/' + S.eu + '/interacoes'] = 0;
      S.naolidos.interacoes = 0; renderAvisos();
      gravarVarios(m).catch(function () {});
    } catch (e) { mensagem('Falha: ' + e.message, 'erro'); }
  }

  async function apagarInteracao(btn) {
    btn.disabled = true;
    try { await req(caminho('biblioteca/interacoes', S.eu, btn.dataset.id), 'DELETE'); btn.closest('li').remove(); }
    catch (e) { btn.disabled = false; toast('Falha ao apagar: ' + e.message, true); }
  }



  async function abrirRanking(mesSel) {
    abrirModal('ranking', '<p class="bbmsg">Carregando…</p>');
    try {
      var meses = Object.keys((await req('biblioteca/ranking', 'GET', undefined, 'shallow=true')) || {}).sort().reverse();
      if (!meses.length) return mensagem('Ainda não há ranking.');
      mesSel = mesSel || (meses.indexOf(mesKey(agora())) !== -1 ? mesKey(agora()) : meses[0]);
      var dados = (await req(caminho('biblioteca/ranking', mesSel))) || {};
      var lista = Object.keys(dados).map(function (k) { return dados[k]; }).filter(function (p) { return p && typeof p.horas === 'number'; })
        .sort(function (a, b) { return b.horas - a.horas; }).slice(0, 10);
      abrirModal('ranking',
        '<h2 class="bbtitulo">Ranking</h2>' +
        '<div class="bbabas bbmeses" role="tablist">' + meses.map(function (m) {
          return '<button type="button" role="tab" class="bbaba' + (m === mesSel ? ' bbatual' : '') + '" aria-selected="' + (m === mesSel) + '" data-acao="ranking-mes" data-mes="' + esc(m) + '">' + esc(m) + '</button>';
        }).join('') + '</div>' +
        (!lista.length ? '<p class="bbrankvazio">Sem dados neste mês.</p>' :
          '<ol class="bbranklista">' + lista.map(function (p, i) {
            return '<li class="bbrankitem bbpos' + (i + 1) + '"><span class="bbrankpos">' + (i + 1) + '</span><span class="bbranknome">' + esc(p.nome) + '</span><span class="bbrankhoras">' + fmtHoras(p.horas) + '</span></li>';
          }).join('') + '</ol>'));
    } catch (e) { mensagem('Falha: ' + e.message, 'erro'); }
  }

  async function abrirHistorico() {
    abrirModal('historico', '<p class="bbmsg">Carregando…</p>');
    try {
      var h = (await req(caminho('biblioteca/historico', S.eu), 'GET', undefined, 'orderBy=%22%24key%22&limitToLast=40')) || {};
      var lista = Object.keys(h).map(function (k) { return h[k]; }).filter(function (s) { return s && s.inicio_em; })
        .sort(function (a, b) { return b.inicio_em - a.inicio_em; }).slice(0, 20);
      if (!lista.length) return mensagem('Nenhuma sessão registrada.');
      abrirModal('historico',
        '<h2 class="bbtitulo">Histórico</h2><ul class="bbhistlista">' + lista.map(function (s) {
          return '<li class="bbhistitem"><span class="bbhistdata">' + fmtData(s.inicio_em) + '</span>' +
            '<span class="bbhisthoras">' + fmtHoras(s.horas_efetivas) + '</span>' +
            (num(s.bonus_pct, 0) ? '<span class="bbhistbonus">' + (s.bonus_pct > 0 ? '+' : '') + s.bonus_pct + '%</span>' : '') +
            (s.mesa_label ? '<span class="bbhistmesa">' + esc(s.mesa_label) + '</span>' : '') +
            (s.livro ? '<span class="bbhistlivro">' + esc(s.livro) + '</span>' : '') + '</li>';
        }).join('') + '</ul>');
    } catch (e) { mensagem('Falha: ' + e.message, 'erro'); }
  }



  function listaMarcos() {
    return Object.keys(S.cfg.marcos).map(function (k) { return Object.assign({ _id: k }, S.cfg.marcos[k]); })
      .filter(function (m) { return m && num(m.horas, 0) > 0; }).sort(function (a, b) { return a.horas - b.horas; });
  }
  function itensMarco(m) { return Object.keys(m.itens || {}).map(function (k) { return m.itens[k]; }).filter(function (i) { return i && i.nome; }); }

  async function abrirMarcos() {
    abrirModal('marcos', '<p class="bbmsg">Carregando…</p>');
    try {
      var mes = mesKey(agora());
      var r = await Promise.all([req(caminho('biblioteca/progresso', S.eu, mes)), req(caminho('casas/membros', S.eu))]);
      S.progresso = r[0] || {};
      var membro = r[1] || null;
      var total = num(S.progresso.horas_efetivas, 0);
      var resg = Array.isArray(S.progresso.marcos_resgatados) ? S.progresso.marcos_resgatados : Object.values(S.progresso.marcos_resgatados || {});
      var destino = !membro ? null : membro.casa === 'adulto' ? 'adulto' : membro.casa;
      abrirModal('marcos',
        '<h2 class="bbtitulo">Marcos</h2>' +
        '<p class="bbmarcostotal">Total este mês: ' + fmtHoras(total) + '</p>' +
        '<ul class="bbmarcoslista">' + listaMarcos().map(function (m) {
          var atingido = total >= m.horas, feito = resg.indexOf(m.horas) !== -1;
          var recompensas = [];
          if (num(m.pontos, 0)) recompensas.push(m.pontos + ' pontos ' + (destino && NOMES_CASAS[destino] ? 'para ' + NOMES_CASAS[destino] : destino === 'adulto' ? '(adultos não pontuam)' : 'para a sua casa'));
          itensMarco(m).forEach(function (i) { recompensas.push(i.nome); });
          return '<li class="bbmarco' + (feito ? ' bbresgatado' : atingido ? ' bbdisp' : ' bbbloq') + '">' +
            '<span class="bbmarcohoras">' + fmtHoras(m.horas) + '</span>' +
            '<span class="bbmarcorec">' + esc(recompensas.join(' · ') || '—') + '</span>' +
            (feito ? '<span class="bbmarcoestado">Resgatado</span>'
              : atingido ? '<button type="button" class="bbbtn bbresgmarco" data-acao="resgatar-marco" data-horas="' + m.horas + '">Resgatar</button>'
              : '<span class="bbmarcobarra"><span class="bbmarcofill" style="--bbprog:' + Math.min(100, Math.round(total / m.horas * 100)) + '%"></span></span>') +
          '</li>';
        }).join('') + '</ul>');
      renderLateral();
    } catch (e) { mensagem('Falha: ' + e.message, 'erro'); }
  }

  async function resgatarMarco(btn) {
    var horas = Number(btn.dataset.horas), mes = mesKey(agora());
    var marco = listaMarcos().filter(function (m) { return m.horas === horas; })[0];
    if (!marco) return;
    btn.disabled = true;
    try {
      var membro = await req(caminho('casas/membros', S.eu));
      var pontos = num(marco.pontos, 0);
      if (pontos && !membro) { btn.disabled = false; return mensagem('Sua casa ainda não foi cadastrada. Fale com a staff para resgatar este marco.'); }
      var trava = await travar('marco_' + S.eu + '_' + mes + '_' + horas);
      if (!trava) { toast('Esse marco já está sendo resgatado.', true); return; }
      var prog = (await req(caminho('biblioteca/progresso', S.eu, mes))) || {};
      var resg = Array.isArray(prog.marcos_resgatados) ? prog.marcos_resgatados : Object.values(prog.marcos_resgatados || {});
      if (resg.indexOf(horas) !== -1) { toast('Marco já resgatado.', true); return abrirMarcos(); }
      if (num(prog.horas_efetivas, 0) < horas) { toast('Você ainda não tem horas suficientes.', true); return abrirMarcos(); }
      var m = {};
      itensMarco(marco).forEach(function (i) {
        m['inventario/' + S.eu + '/' + gerarId()] = { nome: i.nome, descricao: i.descricao || '', categoria: i.categoria || 'Off-Game', valor: 0, quantidade: 1, origem: 'biblioteca' };
      });
      var casa = membro && membro.casa;
      if (pontos && casa && casa !== 'adulto' && NOMES_CASAS[casa]) {
        m['casas/pontos/' + casa] = soma(pontos);
        m['casas/historico/' + gerarId()] = {
          ts: TS, data: fmtData(agora()), casa: casa, valor: pontos,
          motivo: 'Marco ' + fmtHoras(horas) + ' da biblioteca', origem: 'biblioteca',
          personagem_uid: S.eu, personagem_nome: S.user.nome
        };
      }
      m['biblioteca/progresso/' + S.eu + '/' + mes + '/marcos_resgatados'] = resg.concat([horas]);
      travaFeita(m, trava);
      await gravarVarios(m);
      toast(pontos && casa && NOMES_CASAS[casa] ? '+' + pontos + ' pontos para ' + NOMES_CASAS[casa] + '!' : 'Marco resgatado.');
      abrirMarcos();
    } catch (e) { btn.disabled = false; toast('Falha ao resgatar: ' + e.message, true); }
  }



  async function abrirLivros() {
    abrirModal('livros', '<p class="bbmsg">Carregando…</p>');
    try {
      var mes = mesKey(agora());
      var r = await Promise.all([
        req(caminho('biblioteca/livros-dias', S.eu, mes)), req(caminho('biblioteca/progresso', S.eu, mes, 'maestrias')),
        req('biblioteca/livros'), req('maestrias')
      ]);
      var dias = r[0] || {}, prog = r[1] || {}, cat = r[2] || {}, maestrias = r[3] || {};
      var resgatadas = Array.isArray(prog.resgatadas) ? prog.resgatadas : Object.values(prog.resgatadas || {});
      var livrosProg = prog.livros || {};
      var porNome = {};
      Object.keys(cat).forEach(function (k) { if (cat[k]) porNome[cat[k].nome || k] = cat[k]; });
      var cl = S.cfg.livros, meta = num(cl.dias, 10), podeMais = resgatadas.length < num(cl.maestrias_mes, 2);
      var lista = Object.keys(dias).map(function (k) {
        var d = dias[k] || {};
        return { chave: k, nome: d.nome || k, dias: Object.keys(d.dias || {}).length };
      });
      if (!lista.length) return mensagem('Você ainda não estudou nenhum livro este mês.');
      S.livrosMes = lista;
      abrirModal('livros',
        '<h2 class="bbtitulo">Livros</h2>' +
        '<ul class="bblivroslista">' + lista.map(function (l) {
          var feito = (livrosProg[l.chave] && livrosProg[l.chave].resgatado) || (livrosProg[l.nome] && livrosProg[l.nome].resgatado);
          var opcoes = (porNome[l.nome] && porNome[l.nome].maestrias) || [];
          if (!Array.isArray(opcoes)) opcoes = Object.values(opcoes);
          var atingido = l.dias >= meta, acao = '';
          if (feito) acao = '<span class="bblivroestado">Maestria resgatada</span>';
          else if (opcoes.length) {
            acao = '<select class="bblivromaestria" data-livro="' + esc(l.chave) + '"' + (atingido && podeMais ? '' : ' disabled') + '><option value="">Escolha uma maestria</option>' +
              opcoes.map(function (s) { return '<option value="' + esc(s) + '">' + esc((maestrias[s] && maestrias[s].nome) || s) + '</option>'; }).join('') + '</select>' +
              (atingido && podeMais ? '<button type="button" class="bbbtn bbresgmaestria" data-acao="resgatar-maestria" data-livro="' + esc(l.chave) + '">Resgatar</button>'
                : !atingido ? '<span class="bblivroaviso">Faltam ' + (meta - l.dias) + ' dias</span>'
                : '<span class="bblivroaviso">Limite de ' + cl.maestrias_mes + ' por mês atingido</span>');
          }
          return '<li class="bblivro"><span class="bblivronome">' + esc(l.nome) + '</span><span class="bblivrodias">' + l.dias + '/' + meta + ' dias</span>' +
            '<span class="bblivrobarra"><span class="bblivrofill" style="--bbprog:' + Math.min(100, Math.round(l.dias / meta * 100)) + '%"></span></span>' + acao + '</li>';
        }).join('') + '</ul>');
      S.maestriasCat = maestrias;
    } catch (e) { mensagem('Falha: ' + e.message, 'erro'); }
  }

  async function resgatarMaestria(btn) {
    var chave = btn.dataset.livro, mes = mesKey(agora());
    var sel = S.raiz.querySelector('.bblivromaestria[data-livro="' + CSS.escape(chave) + '"]');
    if (!sel || !sel.value) return toast('Escolha uma maestria.', true);
    var slug = sel.value, livro = (S.livrosMes || []).filter(function (l) { return l.chave === chave; })[0];
    btn.disabled = true;
    try {
      var trava = await travar('maestria_' + S.eu + '_' + mes + '_' + chave);
      if (!trava) { toast('Esse resgate já está sendo feito.', true); return; }
      var prog = (await req(caminho('biblioteca/progresso', S.eu, mes, 'maestrias'))) || {};
      var resg = Array.isArray(prog.resgatadas) ? prog.resgatadas : Object.values(prog.resgatadas || {});
      if ((prog.livros || {})[chave] && prog.livros[chave].resgatado) { toast('Já resgatado.', true); return abrirLivros(); }
      if (resg.length >= num(S.cfg.livros.maestrias_mes, 2)) { toast('Limite do mês atingido.', true); return abrirLivros(); }
      var nomeM = (S.maestriasCat && S.maestriasCat[slug] && S.maestriasCat[slug].nome) || slug;
      var m = {};
      m['inventario/' + S.eu + '/' + gerarId()] = {
        nome: '✦ Maestria: ' + nomeM, descricao: 'Para resgatar é necessário fazer uma solicitação no tópico "obtenção de maestrias".',
        categoria: 'Off-Game', valor: 0, quantidade: 1, origem: 'biblioteca'
      };
      m['biblioteca/progresso/' + S.eu + '/' + mes + '/maestrias/resgatadas'] = resg.concat([slug]);
      m['biblioteca/progresso/' + S.eu + '/' + mes + '/maestrias/livros/' + chave] = { resgatado: true, maestria: slug, nome: livro ? livro.nome : chave };
      travaFeita(m, trava);
      await gravarVarios(m);
      toast('Maestria resgatada.');
      abrirLivros();
    } catch (e) { btn.disabled = false; toast('Falha: ' + e.message, true); }
  }


  async function abrirDupla() {
    abrirModal('dupla', '<p class="bbmsg">Carregando…</p>');
    try {
      var dia = diaKey(agora());
      var r = await Promise.all([req(caminho('biblioteca/duplas/hoje', dia)), req(caminho('biblioteca/convites', S.eu))]);
      var duplas = r[0] || {}, convites = r[1] || {};
      var minha = duplas[S.eu] || null;
      var vistas = {}, lista = [];
      Object.keys(duplas).forEach(function (k) {
        var d = duplas[k]; if (!d) return;
        var c = [d.uid1, d.uid2].sort().join('-'); if (vistas[c]) return; vistas[c] = true; lista.push(d);
      });
      var conv = Object.keys(convites).filter(function (k) { return convites[k]; }).map(function (k) { return Object.assign({ _id: k }, convites[k]); })
        .sort(function (a, b) { return num(b.ts, 0) - num(a.ts, 0); });
      var bonus = num(S.cfg.dupla.bonus_pct, 5);
      abrirModal('dupla',
        '<h2 class="bbtitulo">Duplas de hoje</h2>' +
        (minha ? '<div class="bbduplaminha"><span class="bbduplanome">' + esc(minha.nome1) + '</span><span class="bbduplae">&amp;</span><span class="bbduplanome">' + esc(minha.nome2) + '</span><span class="bbduplabonus">+' + bonus + '% nas horas da sessão</span></div>' : '') +
        (!lista.length ? '<p class="bbduplavazio">Nenhuma dupla formada hoje.</p>' :
          '<ul class="bbduplalista">' + lista.map(function (d) { return '<li class="bbduplaitem"><span class="bbduplanome">' + esc(d.nome1) + '</span><span class="bbduplae">&amp;</span><span class="bbduplanome">' + esc(d.nome2) + '</span></li>'; }).join('') + '</ul>') +
        (!minha && conv.length ? '<h3 class="bbduplasub">Convites recebidos</h3><ul class="bbconvites">' + conv.map(function (c) {
          var exp = c.expirado || c.aceito || !c.ts || diaKey(c.ts) !== dia;
          return '<li class="bbconvite' + (exp ? ' bbexpirado' : '') + '"><span class="bbconvnome">' + esc(c.remetente_nome) + '</span>' +
            (exp ? '<span class="bbconvestado">Expirado</span><button type="button" class="bbconvapagar" data-acao="apagar-convite" data-id="' + esc(c._id) + '" aria-label="Apagar">×</button>'
              : '<button type="button" class="bbbtn bbaceitar" data-acao="aceitar-convite" data-id="' + esc(c._id) + '">Aceitar</button>') + '</li>';
        }).join('') + '</ul>' : '') +
        (!minha ? '<button type="button" class="bbbtn bbconvidar" data-acao="convidar">Convidar alguém</button>' : ''));
      S.convites = conv;
      zerarNaoLido('convites');
    } catch (e) { mensagem('Falha: ' + e.message, 'erro'); }
  }

  async function convidar() {
    if (!S.minha) return mensagem('Você precisa estar estudando para convidar alguém.');
    try {
      var dia = diaKey(agora());
      var r = await Promise.all([req('biblioteca/ativas'), req(caminho('biblioteca/duplas/hoje', dia), 'GET', undefined, 'shallow=true')]);
      var ativas = r[0] || {}, comDupla = r[1] || {}, t = agora();
      if (comDupla[S.eu]) return mensagem('Você já tem uma dupla hoje.');
      var disp = Object.keys(ativas).map(function (k) { return ativas[k]; })
        .filter(function (s) { return ativaValida(s) && s.termina_em > t && fk(s.uid) !== S.eu && !comDupla[fk(s.uid)]; });
      if (!disp.length) return mensagem('Ninguém disponível para formar dupla agora.');
      abrirModal('convidar',
        '<h2 class="bbtitulo">Convidar para dupla</h2><ul class="bbconvidarlista">' + disp.map(function (s) {
          return '<li class="bbconvidaritem"><span class="bbconvidarnome">' + esc(s.nome) + '</span><button type="button" class="bbbtn bbenviarconv" data-acao="enviar-convite" data-uid="' + esc(fk(s.uid)) + '">Convidar</button></li>';
        }).join('') + '</ul>');
    } catch (e) { mensagem('Falha: ' + e.message, 'erro'); }
  }

  async function enviarConvite(btn) {
    var alvo = btn.dataset.uid;
    btn.disabled = true;
    try {
      var m = {};
      m['biblioteca/convites/' + alvo + '/' + gerarId()] = { remetente_uid: S.eu, remetente_nome: S.user.nome, expirado: false, aceito: false, ts: TS };
      m['biblioteca/naolidos/' + alvo + '/convites'] = soma(1);
      await gravarVarios(m);
      btn.outerHTML = '<span class="bbconvidarok">Convite enviado</span>';
    } catch (e) { btn.disabled = false; toast('Falha: ' + e.message, true); }
  }

  async function aceitarConvite(btn) {
    var c = (S.convites || []).filter(function (x) { return x._id === btn.dataset.id; })[0];
    if (!c) return;
    if (!S.minha) return mensagem('Você precisa estar estudando para aceitar um convite.');
    btn.disabled = true;
    var rem = fk(c.remetente_uid), dia = diaKey(agora());
    try {
      var r = await Promise.all([req(caminho('biblioteca/ativas', rem)), req(caminho('biblioteca/duplas/hoje', dia), 'GET', undefined, 'shallow=true')]);
      var sessaoRem = r[0], comDupla = r[1] || {};
      var expirar = function (msg) { req(caminho('biblioteca/convites', S.eu, c._id, 'expirado'), 'PUT', true).catch(function () {}); mensagem(msg); };
      if (!ativaValida(sessaoRem) || sessaoRem.termina_em <= agora()) return expirar(c.remetente_nome + ' não está mais estudando. O convite expirou.');
      if (comDupla[S.eu]) return mensagem('Você já tem uma dupla hoje.');
      if (comDupla[rem]) return expirar(c.remetente_nome + ' já formou dupla com outra pessoa hoje.');
      var t1 = await travar('dupla_' + dia + '_' + S.eu);
      var t2 = t1 && await travar('dupla_' + dia + '_' + rem);
      if (!t1 || !t2) { toast('Outra dupla está sendo formada agora. Tente de novo.', true); btn.disabled = false; return; }
      var bonus = num(S.cfg.dupla.bonus_pct, 5);
      var dupla = { uid1: rem, nome1: c.remetente_nome, uid2: S.eu, nome2: S.user.nome, bonus_pct: bonus, ts: TS };
      var m = {};
      m['biblioteca/duplas/hoje/' + dia + '/' + S.eu] = dupla;
      m['biblioteca/duplas/hoje/' + dia + '/' + rem] = dupla;
      m['biblioteca/ativas/' + S.eu + '/bonus_dupla_pct'] = bonus;
      m['biblioteca/ativas/' + rem + '/bonus_dupla_pct'] = bonus;
      m['biblioteca/convites/' + S.eu + '/' + c._id + '/aceito'] = true;
      travaFeita(m, t1); travaFeita(m, t2);
      await gravarVarios(m);
      toast('Dupla formada com ' + c.remetente_nome + '!');
      await atualizar(true);
      abrirDupla();
    } catch (e) { btn.disabled = false; toast('Falha: ' + e.message, true); }
  }

  async function apagarConvite(btn) {
    btn.disabled = true;
    try { await req(caminho('biblioteca/convites', S.eu, btn.dataset.id), 'DELETE'); btn.closest('li').remove(); }
    catch (e) { btn.disabled = false; toast('Falha: ' + e.message, true); }
  }



  var ACOES = {
    'andar': function (el) { irParaAndar(Number(el.dataset.andar)); },
    'menu': abrirMenu,
    'fechar-modal': fecharModal,
    'confirmar-sim': function () { responderConfirmar(true); },
    'confirmar-nao': function () { responderConfirmar(false); },
    'entrar': abrirEntrada,
    'escolher-mesa': function (el) { escolher(el, 'mesa'); },
    'escolher-hora': function (el) { escolher(el, 'hora'); },
    'confirmar-entrada': confirmarEntrada,
    'sair': sair,
    'interagir': interagir,
    'bilhetes': abrirBilhetes,
    'apagar-bilhete': apagarBilhete,
    'apagar-lidos': apagarLidos,
    'resgatar-energia': resgatarEnergia,
    'escrever-bilhete': escreverBilhete,
    'enviar-bilhete': enviarBilhete,
    'interacoes': function () { abrirInteracoes('recebidas'); },
    'interacoes-aba': function (el) { abrirInteracoes(el.dataset.aba); },
    'apagar-interacao': apagarInteracao,
    'ranking': function () { abrirRanking(); },
    'ranking-mes': function (el) { abrirRanking(el.dataset.mes); },
    'historico': abrirHistorico,
    'marcos': abrirMarcos,
    'resgatar-marco': resgatarMarco,
    'livros': abrirLivros,
    'resgatar-maestria': resgatarMaestria,
    'dupla': abrirDupla,
    'convidar': convidar,
    'enviar-convite': enviarConvite,
    'aceitar-convite': aceitarConvite,
    'apagar-convite': apagarConvite,
    'ritual-acao': ritualAcao,
    'ritual-resgatar': ritualResgatar,
    'icone': clicarIcone
  };

  function ligarEventos() {
    S.raiz.addEventListener('click', function (ev) {
      var el = ev.target.closest('[data-acao]');
      if (ev.target.classList.contains('bbmodal')) { fecharModal(); return; }
      if (!el || !S.raiz.contains(el)) { if (!ev.target.closest('.bbmais')) fecharMenu(); return; }
      if (el.dataset.acao !== 'menu') fecharMenu();
      var fn = ACOES[el.dataset.acao];
      if (fn && !el.disabled) fn(el, ev);
    });
    S.raiz.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        if (!q('.bbconfbox').hidden) responderConfirmar(false);
        else if (!q('.bbmodal').hidden) fecharModal();
        else fecharMenu();
      }
      if (ev.key === 'Enter' && ev.target.classList.contains('bbcardcampo')) { ev.preventDefault(); ev.target.blur(); }
    });
    S.raiz.addEventListener('focusout', function (ev) {
      if (ev.target.classList && ev.target.classList.contains('bbcardcampo')) salvarStatus(ev.target);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') atualizar();
    });
  }



  function getUser() {
    if (typeof _userdata !== 'undefined' && _userdata && _userdata.session_logged_in && Number(_userdata.user_id) > 0)
      return { uid: String(_userdata.user_id).trim(), nome: _userdata.username || '' };
    return null;
  }

  async function iniciar() {
    S.raiz = document.getElementById('bibliobx1');
    if (!S.raiz) return;
    S.user = getUser();
    if (!S.user) {
      S.raiz.classList.add('bb', 'bbdeslogado');
      S.raiz.innerHTML = '<p class="bbdeslogado">Entre na sua conta para usar a biblioteca.</p>';
      return;
    }
    S.eu = fk(S.user.uid);
    S.raiz.classList.add('bb', 'bbcarregando');
    S.raiz.innerHTML = '<p class="bbcarregando">Abrindo a biblioteca…</p>';
    await Promise.all([carregarConfig(), sincronizarRelogio()]);
    try { S.atributos = (await req(caminho('atributos', S.eu))) || {}; } catch (e) {}
    await Promise.all([carregarHoje(), carregarProgresso()]);
    S.raiz.classList.remove('bbcarregando');
    montarEstrutura();
    ligarEventos();
    await atualizar(true);
    tick();
    S.timerCrono = setInterval(tick, 1000);
    S.timerAtualizar = setInterval(atualizar, Math.max(10, num(S.cfg.geral.atualizacao_s, 30)) * 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();