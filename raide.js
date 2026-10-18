(function () {
  'use strict';

  var DB = 'https://unsheltered-72d40-default-rtdb.firebaseio.com';
  var FUSO_MS = -3 * 3600000;
  var TRAVA_VALIDADE_MS = 120000;

  var PADRAO = {
    abre:  Date.parse('2026-10-15T00:00:00-03:00'),
    prazo: Date.parse('2026-10-29T23:59:59-03:00'),
    ataques_dia: 3,
    feitico_uma_vez_dia: true,
    energia_soco: 30,
    atualizacao_s: 20,
    log_qtd: 8,
    rank_qtd: 5,
    dano_max_ataque: 2000,
    imagem_padrao: '',
    bosses: {
      trasgo:     { hp_tot: 15000 },
      dementador: { hp_tot: 15000 }
    },
    contra: {
      ativo: true,
      golpes: {
        fraco: { pct_vida: 10, chance: 60 },
        medio: { pct_vida: 15, chance: 30 },
        forte: { pct_vida: 30, chance: 10 }
      }
    },

    reserva: [0, 5, 10, 15, 30, 40, 55, 80, 100, 125, 150],

    desconto_energia: { 6: 5, 7: 10, 8: 15, 9: 20, 10: 25 },

    mult_soco: { 'vampiro': 5, 'vampira': 5, 'meio-vampiro': 4, 'meio-vampira': 4, 'meio-gigante': 5 },

    mult_resist: { 'duende': 4, 'meio-duende': 2, 'meio-gigante': 2 },

    nucleos_ataque: {
      'Snallygaster': 7,
      'Fireball Catalão': 5,
      'Negro Hebrideano': 5,
      'Rabo-de-Chumbo Húngaro': 5,
      'Bola de Fogo Chinês': 5,
      'Pena de Fênix': 5,
      'Cabelo de Veela': 3
    },
    nucleos_defesa: {
      'Unicórnio': 5,
      'Chifre-Longo Romeno': 5
    },

    feiticos: {}
  };

  var S = {
    usados: {}, catalogo: null, teste: false, no: 'raide',
    raiz: null, boss: null, user: null, eu: null, cfg: null, offset: 0,
    perfil: {}, atributos: {}, status: null, maestrias: {}, opcoes: [],
    bossDados: null, ataquesHoje: 0, atacando: false, timerCrono: null, timerAtualizar: null
  };

  function fk(uid) { return 'u' + String(uid).replace(/^u/i, ''); }
  function agora() { return Math.round(Date.now() + S.offset); }
  function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function num(v, padrao) { var n = Number(v); return Number.isFinite(n) ? n : padrao; }
  function pct(v) {
    var m = String(v == null ? '' : v).match(/-?\d+(?:[.,]\d+)?/);
    return m ? Number(m[0].replace(',', '.')) : 0;
  }
  function p2(n) { return String(n).padStart(2, '0'); }
  function diaKey(ms) {
    var d = new Date(ms + FUSO_MS);
    return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate());
  }
  function milhar(n) { return Math.max(0, Math.round(n)).toLocaleString('pt-BR'); }
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }
  function caminho() {
    return Array.prototype.slice.call(arguments).map(function (p) {
      return String(p).split('/').map(encodeURIComponent).join('/');
    }).join('/');
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function mesclar(padrao, salvo) {
    if (salvo === undefined || salvo === null) return clone(padrao);
    if (typeof padrao !== 'object' || padrao === null || Array.isArray(padrao)) return salvo;
    var r = {};
    Object.keys(padrao).forEach(function (k) { r[k] = mesclar(padrao[k], salvo[k]); });
    Object.keys(salvo).forEach(function (k) { if (!(k in r)) r[k] = salvo[k]; });
    return r;
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

  async function travar() {
    var cam = caminho(S.no + '/travas', S.eu);
    var atual = await req(cam);
    if (atual && agora() - num(atual.em, 0) < TRAVA_VALIDADE_MS) return null;
    var token = gerarId();
    await req(cam, 'PUT', { token: token, em: agora(), uid: S.eu });
    await esperar(1500);
    var depois = await req(cam);
    if (!depois || depois.token !== token) return null;
    return { cam: S.no + '/travas/' + S.eu };
  }
  function soltar() { return req(caminho(S.no + '/travas', S.eu), 'DELETE').catch(function () {}); }

  async function sincronizarRelogio() {
    try {
      var cam = caminho(S.no + '/relogio', S.eu);
      var t0 = Date.now();
      await req(cam, 'PUT', TS);
      var ts = await req(cam);
      var t1 = Date.now();
      if (typeof ts === 'number') S.offset = Math.round(ts - (t0 + t1) / 2);
    } catch (e) { S.offset = 0; }
  }

  async function carregarConfig() {
    var salvo = null;
    try { salvo = await req('raide/configuracao'); } catch (e) {}
    salvo = salvo || {};
    var cfg = {};
    Object.keys(PADRAO).forEach(function (k) {
      if (['bosses', 'mult_soco', 'mult_resist', 'nucleos_ataque', 'nucleos_defesa', 'feiticos', 'reserva', 'desconto_energia'].indexOf(k) >= 0)
        cfg[k] = clone(salvo[k] || PADRAO[k]);
      else cfg[k] = mesclar(PADRAO[k], salvo[k]);
    });
    if (!Array.isArray(cfg.reserva)) cfg.reserva = Object.values(cfg.reserva || {});
    S.cfg = cfg;
  }

  function el(cls) { return S.raiz.querySelector('.' + cls); }
  function texto(cls, v) { var e = el(cls); if (e) e.textContent = v; }
  function mostrar(cls, sim) { var e = el(cls); if (e) e.style.display = sim ? '' : 'none'; }
  function nomeBoss() { var e = el('raidenome'); return e ? e.textContent.trim() : 'O boss'; }
  function aviso(msg) {
    var e = el('raideaviso');
    if (!e) return;
    e.textContent = msg || '';
    e.style.display = msg ? '' : 'none';
  }

  function nivelMagia() { return Math.max(0, Math.min(S.cfg.reserva.length - 1, Math.floor(num(S.perfil.magia, 0)))); }
  function reservaPct() { return num(S.cfg.reserva[nivelMagia()], 0); }
  function descontoEnergia() { return num(S.cfg.desconto_energia[nivelMagia()], 0); }
  function especie() { return norm(S.perfil.especie || S.atributos.especie || ''); }
  function nucleoTexto() {
    var v = S.perfil.varinha;
    var t = v && typeof v === 'object' ? v.texto : v;
    return norm(String(t || '').split(',')[0]);
  }
  function bonusNucleo(tabela) {
    var nucleo = nucleoTexto();
    if (!nucleo) return 0;
    var melhor = 0;
    Object.keys(tabela || {}).forEach(function (k) {
      if (nucleo.indexOf(norm(k)) >= 0) melhor = Math.max(melhor, num(tabela[k], 0));
    });
    return melhor;
  }
  function multEspecie(tabela, padrao) {
    var e = especie();
    var t = tabela || {};
    for (var k in t) if (norm(k) === e) return num(t[k], padrao);
    return padrao;
  }
  function maestriaCombate() {
    var m = S.maestrias && S.maestrias.maestria_em_combate;
    return m ? pct(m.porcentagem) : 0;
  }

  function danoFeitico(base) {
    var intel = num(S.atributos.inteligencia, 0), det = num(S.atributos.determinacao, 0);
    var mult = (reservaPct() + bonusNucleo(S.cfg.nucleos_ataque)) / 100;
    return Math.round(base + intel + det + base * mult);
  }
  function energiaFeitico(base) {
    return Math.max(0, Math.round(base * (1 - descontoEnergia() / 100)));
  }
  function danoSoco() {
    var forca = num(S.atributos.forca, 0);
    var mult = multEspecie(S.cfg.mult_soco, 3);
    return Math.max(1, Math.round(forca * mult * (1 + maestriaCombate() / 100)));
  }
  function sortearGolpe() {
    var golpes = S.cfg.contra.golpes || {};
    var ids = Object.keys(golpes).filter(function (k) { return golpes[k] && num(golpes[k].chance, 0) > 0; });
    var total = ids.reduce(function (s, k) { return s + num(golpes[k].chance, 0); }, 0);
    if (!total) return null;
    var r = Math.random() * total;
    for (var i = 0; i < ids.length; i++) {
      r -= num(golpes[ids[i]].chance, 0);
      if (r < 0) return golpes[ids[i]];
    }
    return golpes[ids[ids.length - 1]];
  }
  function danoContra(golpe, hpTot) {
    var bruto = hpTot * num(golpe.pct_vida, 0) / 100;
    var resist = num(S.atributos.resistencia, 0) * multEspecie(S.cfg.mult_resist, 1);
    var reducao = Math.min(95, resist + bonusNucleo(S.cfg.nucleos_defesa));
    return Math.max(0, Math.round(bruto * (1 - reducao / 100)));
  }

  function fixo(txt, palavra) {
    var m = String(txt || '').trim().match(new RegExp('^(\\d+)\\s+de\\s+' + palavra + '\\b', 'i'));
    return m ? Number(m[1]) : null;
  }

  async function montarOpcoes() {
    var r = await Promise.all([
      req(caminho('feiticos-aprendidos', S.eu)).catch(function () { return null; }),
      req(caminho('feiticos-anos', S.eu)).catch(function () { return null; }),
      S.catalogo ? Promise.resolve(S.catalogo) : req('feiticos').catch(function () { return null; })
    ]);
    var aprendidos = r[0] || {};
    var anos = r[1] || [];
    var catalogo = S.catalogo = r[2] || {};
    var lista = [];
    var liberados = S.cfg.feiticos || {};

    var tem = {};
    Object.keys(catalogo).forEach(function (slug) {
      var f = catalogo[slug];
      var m = f && String(f.ano || '').match(/^\s*(\d+)\s*º?\s*ano/i);
      if (m && anos[Number(m[1])]) tem[slug] = true;
    });
    Object.keys(aprendidos).forEach(function (slug) { if (aprendidos[slug]) tem[slug] = true; });

    Object.keys(tem).forEach(function (slug) {
      var f = catalogo[slug];
      var l = liberados[slug];
      if (l && l.ativo === false) return;

      var base = l && l.dano != null ? num(l.dano, null) : (f ? fixo(f.dano, 'dano') : null);
      var energia = l && l.energia != null ? num(l.energia, null) : (f ? fixo(f.energia, 'energia') : null);
      if (!(base > 0) || energia === null) return;
      lista.push({
        tipo: 'feitico', slug: slug, nome: (f && f.nome) || (liberados[slug] && liberados[slug].nome) || slug,
        dano: danoFeitico(base), energia: energiaFeitico(energia)
      });
    });
    lista.sort(function (a, b) { return a.nome.localeCompare(b.nome); });
    lista.push({ tipo: 'soco', slug: 'soco', nome: 'Soco', dano: danoSoco(), energia: num(S.cfg.energia_soco, 30) });
    S.opcoes = lista;
    desenharOpcoes();
  }

  function usadoHoje(o) {
    return !!(o && o.tipo === 'feitico' && S.cfg.feitico_uma_vez_dia !== false && S.usados[o.slug]);
  }
  function desenharOpcoes() {
    var sel = el('raideselect');
    if (!sel) return;
    var atual = sel.value;
    sel.innerHTML = S.opcoes.map(function (o, i) {
      var usado = usadoHoje(o);
      return '<option value="' + i + '"' + (usado ? ' disabled' : '') + '>' + esc(o.nome) + ' · ' + o.dano + ' de dano · ' + o.energia + ' de energia' + (usado ? ' (usado hoje)' : '') + '</option>';
    }).join('');
    var opt = atual && sel.querySelector('option[value="' + atual + '"]');
    if (opt && !opt.disabled) sel.value = atual;
    else {
      var livre = sel.querySelector('option:not([disabled])');
      if (livre) sel.value = livre.value;
    }
  }

  function bossCfg() { return S.cfg.bosses[S.boss] || { hp_tot: 0 }; }
  function hpTotBoss() { return num((S.bossDados && S.bossDados.hp_tot) || bossCfg().hp_tot, 0); }
  function hpBoss() { return Math.max(0, hpTotBoss() - num(S.bossDados && S.bossDados.dano_total, 0)); }
  function bossMorto() { return hpTotBoss() > 0 && hpBoss() <= 0; }
  function encerrado() { return !S.teste && agora() > S.cfg.prazo; }
  function naoAbriu() { return !S.teste && agora() < S.cfg.abre; }
  function camStatus() { return S.teste ? S.no + '/status/' + S.eu : 'status-perfil/' + S.eu; }

  function desenharBoss() {
    var tot = hpTotBoss(), hp = hpBoss();
    var barra = el('raidevida');
    if (barra) barra.style.width = (tot > 0 ? Math.max(0, Math.min(100, hp / tot * 100)) : 0).toFixed(2) + '%';
    texto('raidehpatual', milhar(hp));
    texto('raidehptotal', milhar(tot));
    var fim = bossMorto() || encerrado();
    S.raiz.classList.toggle('raidefim', fim);
    if (fim) texto('raideselo', bossMorto() ? 'Derrotado' : 'Escapou');
  }

  function desenharJogador() {
    var st = S.status || {};
    var vida = S.raiz.querySelector('.raidestatvida .raidestatvalor');
    var ener = S.raiz.querySelector('.raidestatenergia .raidestatvalor');
    var atq = S.raiz.querySelector('.raidestatataques .raidestatvalor');
    if (vida) vida.textContent = num(st.hp_cur, 0) + ' / ' + num(st.hp_tot, 0);
    if (ener) ener.textContent = num(st.energia_cur, 0) + ' / ' + num(st.energia_tot, 0);
    if (atq) atq.textContent = S.ataquesHoje + ' / ' + num(S.cfg.ataques_dia, 3);
  }

  function motivoBloqueio(opcao) {
    if (!S.user) return 'Entre na sua conta para atacar.';
    if (naoAbriu()) return 'A raide ainda não começou.';
    if (bossMorto()) return nomeBoss() + ' já foi derrotado.';
    if (encerrado()) return 'O prazo da raide terminou.';
    if (!S.status) return 'Seu personagem não tem vida e energia cadastradas. Fale com a staff.';
    if (num(S.status.hp_cur, 0) <= 0) return 'Você está sem vida. Recupere-se antes de voltar a lutar.';
    if (S.ataquesHoje >= num(S.cfg.ataques_dia, 3)) return 'Você já atacou ' + S.ataquesHoje + ' vezes hoje. Volte amanhã.';
    if (usadoHoje(opcao)) return 'Você já usou ' + opcao.nome + ' contra ' + nomeBoss() + ' hoje. Escolha outro ataque.';
    if (opcao && num(S.status.energia_cur, 0) < opcao.energia) return 'Energia insuficiente para ' + opcao.nome + '.';
    return '';
  }

  function atualizarBotao() {
    var sel = el('raideselect'), btn = el('raidebtn');
    var opcao = sel ? S.opcoes[Number(sel.value)] : null;
    var motivo = motivoBloqueio(opcao);
    if (btn) btn.disabled = !!motivo || S.atacando;
    aviso(motivo);
  }

  function linhaLog(a) {
    return '<div class="raidelinha">' +
      '<span class="raidequem">' + esc(a.nome) + '</span>' +
      '<span class="raidecomo">' + esc(a.acao) + '</span>' +
      '<span class="raidedano">−' + milhar(a.dano) + '</span>' +
      '</div>';
  }

  function linhaRank(r, i) {
    var img = r.imagem || S.cfg.imagem_padrao;
    var fundo = img ? ' style="background-image:url(\'' + esc(img).replace(/\(/g, '%28').replace(/\)/g, '%29') + '\');background-size:cover;background-position:center"' : '';
    var origem = '';
    if (r.especie || r.sangue) {
      origem = '<span class="raideorigem">' +
        (r.especie ? '<span class="raideespecie">' + esc(r.especie) + '</span>' : '') +
        (r.sangue ? '<span class="raidesangue">' + esc(r.sangue) + '</span>' : '') +
        '</span>';
    }
    return '<div class="raidelinha">' +
      '<span class="raidepos"' + fundo + '>' + (i + 1) + '</span>' +
      '<span class="raidequem">' + esc(r.nome) + origem + '</span>' +
      '<span class="raidedano">' + milhar(r.dano) + '</span>' +
      '</div>';
  }

  async function atualizar() {
    var dia = diaKey(agora());
    var tarefas = [
      req(caminho(S.no + '/bosses', S.boss)).catch(function () { return null; }),
      req(caminho(S.no + '/ataques', S.boss), 'GET', undefined, 'orderBy=%22%24key%22&limitToLast=' + num(S.cfg.log_qtd, 8)).catch(function () { return null; }),
      req(caminho(S.no + '/ranking', S.boss)).catch(function () { return null; })
    ];
    if (S.user) {
      tarefas.push(req(camStatus()).catch(function () { return null; }));
      tarefas.push(req(caminho(S.no + '/hoje', dia, S.eu)).catch(function () { return 0; }));
      tarefas.push(req(caminho(S.no + '/usados', dia, S.boss, S.eu)).catch(function () { return null; }));
    }
    var r = await Promise.all(tarefas);
    S.bossDados = r[0] || {};
    if (S.user) { S.status = r[3]; S.ataquesHoje = num(r[4], 0); S.usados = r[5] || {}; desenharOpcoes(); }

    var ataques = r[1] || {};
    var lista = el('raidelog') && el('raidelog').querySelector('.raidelista');
    if (lista) {
      var itens = Object.keys(ataques).sort().reverse().map(function (k) { return ataques[k]; });
      lista.innerHTML = itens.length ? itens.map(linhaLog).join('') : '';
    }

    var ranking = r[2] || {};
    var rank = el('raiderank') && el('raiderank').querySelector('.raidelista');
    if (rank) {
      var top = Object.keys(ranking).map(function (k) { return ranking[k]; })
        .filter(function (x) { return x && num(x.dano, 0) > 0; })
        .sort(function (a, b) { return num(b.dano, 0) - num(a.dano, 0); })
        .slice(0, num(S.cfg.rank_qtd, 5));
      rank.innerHTML = top.map(linhaRank).join('');
    }

    desenharBoss();
    desenharJogador();
    atualizarBotao();
  }

  function tick() {
    var t = agora();
    var alvo = naoAbriu() ? S.cfg.abre : S.cfg.prazo;
    texto('raidetempotxt', naoAbriu() ? 'Começa em' : (encerrado() ? 'Encerrada' : 'Termina em'));
    var s = Math.max(0, Math.floor((alvo - t) / 1000));
    texto('raidetempovalor', encerrado() ? '—' :
      Math.floor(s / 86400) + 'd ' + p2(Math.floor((s % 86400) / 3600)) + 'h ' + p2(Math.floor((s % 3600) / 60)) + 'm');
    if (encerrado() && !S.raiz.classList.contains('raidefim')) { desenharBoss(); atualizarBotao(); }
  }

  async function atacar() {
    if (S.atacando) return;
    var sel = el('raideselect');
    var opcao = sel ? S.opcoes[Number(sel.value)] : null;
    if (!opcao || motivoBloqueio(opcao)) { atualizarBotao(); return; }
    S.atacando = true;
    var btn = el('raidebtn');
    if (btn) btn.disabled = true;
    aviso('');
    var trava = null, erro = '';
    try {
      trava = await travar();
      if (!trava) throw new Error('Já existe um ataque seu em andamento. Aguarde alguns segundos.');

      var dia = diaKey(agora());
      var r = await Promise.all([
        req(camStatus()),
        req(caminho(S.no + '/hoje', dia, S.eu)),
        req(caminho(S.no + '/bosses', S.boss)),
        req(caminho(S.no + '/usados', dia, S.boss, S.eu))
      ]);
      S.status = r[0]; S.ataquesHoje = num(r[1], 0); S.bossDados = r[2] || {}; S.usados = r[3] || {};
      var motivo = motivoBloqueio(opcao);
      if (motivo) throw new Error(motivo);

      var dano = Math.min(opcao.dano, hpBoss());
      if (!(dano > 0) || dano > num(S.cfg.dano_max_ataque, 2000)) throw new Error('Ataque inválido. Recarregue a página.');
      var matou = dano >= hpBoss();

      var contra = 0;
      if (!matou && S.cfg.contra.ativo !== false) {
        var golpe = sortearGolpe();
        if (golpe) contra = Math.min(num(S.status.hp_cur, 0), danoContra(golpe, num(S.status.hp_tot, 0)));
      }

      var m = {};
      m[S.no + '/bosses/' + S.boss + '/dano_total'] = soma(dano);
      if (!S.bossDados.hp_tot) m[S.no + '/bosses/' + S.boss + '/hp_tot'] = hpTotBoss();
      m[S.no + '/ataques/' + S.boss + '/' + gerarId()] = {
        uid: S.eu, nome: S.user.nome, acao: opcao.nome, dano: dano, contra: contra, ts: TS
      };
      var base = S.no + '/ranking/' + S.boss + '/' + S.eu + '/';
      m[base + 'dano'] = soma(dano);
      m[base + 'nome'] = S.user.nome;
      m[base + 'especie'] = S.perfil.especie || S.atributos.especie || '';
      m[base + 'sangue'] = S.perfil.sangue || '';
      m[base + 'imagem'] = (S.perfil.imagem && S.perfil.imagem.url) || '';
      m[S.no + '/hoje/' + dia + '/' + S.eu] = soma(1);
      if (opcao.tipo === 'feitico') m[S.no + '/usados/' + dia + '/' + S.boss + '/' + S.eu + '/' + opcao.slug] = true;
      m[camStatus() + '/energia_cur'] = soma(-opcao.energia);
      if (contra > 0) m[camStatus() + '/hp_cur'] = soma(-contra);
      m[trava.cam] = null;
      await gravarVarios(m);
      trava = null;

      var rd = el('raideresdano'), rc = el('raiderescontra');
      if (rd) rd.innerHTML = 'Você usou ' + esc(opcao.nome) + ' e causou <b>' + milhar(dano) + '</b> de dano.' +
        (matou ? ' ' + esc(nomeBoss()) + ' foi derrotado!' : '');
      if (rc) {
        rc.innerHTML = contra > 0 ? esc(nomeBoss()) + ' revidou e tirou <b>' + milhar(contra) + '</b> de vida.' : '';
        rc.style.display = contra > 0 ? '' : 'none';
      }
      mostrar('raideresultado', true);
      await montarOpcoes();
    } catch (e) {
      erro = e.message || 'Não foi possível atacar. Tente de novo.';
    } finally {
      if (trava) await soltar();
      S.atacando = false;
      try { await atualizar(); } catch (e) {}
      if (erro) aviso(erro);
    }
  }

  function getUser() {
    if (typeof _userdata !== 'undefined' && _userdata && _userdata.session_logged_in && Number(_userdata.user_id) > 0)
      return { uid: String(_userdata.user_id).trim(), nome: _userdata.username || '' };
    return null;
  }

  async function iniciar() {
    S.raiz = document.querySelector('.raidebx[data-boss]');
    if (!S.raiz) return;
    S.boss = S.raiz.getAttribute('data-boss');

    S.teste = S.raiz.getAttribute('data-teste') === '1';
    S.no = S.teste ? 'raide-teste' : 'raide';
    if (S.teste) S.raiz.classList.add('raideteste');
    S.user = getUser();
    if (S.user) S.eu = fk(S.user.uid);

    mostrar('raideresultado', false);
    aviso('');
    var sel = el('raideselect');
    if (sel) sel.innerHTML = '';
    ['raidelog', 'raiderank'].forEach(function (c) {
      var l = el(c) && el(c).querySelector('.raidelista');
      if (l) l.innerHTML = '';
    });

    await Promise.all([carregarConfig(), S.user ? sincronizarRelogio() : Promise.resolve()]);

    if (S.user) {
      var dados = await Promise.all([
        req(caminho('perfil', S.eu)).catch(function () { return null; }),
        req(caminho('atributos', S.eu)).catch(function () { return null; }),
        req(caminho('maestrias-personagem', S.eu)).catch(function () { return null; })
      ]);
      S.perfil = dados[0] || {};
      S.atributos = dados[1] || {};
      S.maestrias = dados[2] || {};
      if (S.teste) {
        var copia = await req(camStatus()).catch(function () { return null; });
        if (!copia) {
          var real = await req(caminho('status-perfil', S.eu)).catch(function () { return null; });
          if (real) await req(camStatus(), 'PUT', real).catch(function () {});
        }
        aviso('');
      }
      await montarOpcoes();
    }

    if (sel) sel.addEventListener('change', atualizarBotao);
    var btn = el('raidebtn');
    if (btn) btn.addEventListener('click', atacar);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && !S.atacando) atualizar().catch(function () {});
    });

    await atualizar().catch(function () { aviso('Não foi possível carregar a raide. Recarregue a página.'); });
    tick();
    S.timerCrono = setInterval(tick, 1000);
    S.timerAtualizar = setInterval(function () {
      if (!S.atacando && document.visibilityState !== 'hidden') atualizar().catch(function () {});
    }, Math.max(10, num(S.cfg.atualizacao_s, 20)) * 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();